from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.schemas.bol import BolSaveRequest
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)

class BolService:
    
    @staticmethod
    async def get_initial_bol_data(db: AsyncSession):
        """
        Fetches all orders and separates them into pending/fulfilled lists.
        Direct SQL implementation for performance.
        """
        try:
            # Query all orders
            result = await db.execute(text("SELECT order_number, status, created_at FROM orders"))
            orders = result.fetchall()
            
            pending_list = []
            fulfilled_list = []
            
            for row in orders:
                key = row.order_number
                status = row.status
                created_at = row.created_at # datetime object
                
                display = f"{key} ({status})"
                timestamp = created_at.isoformat() if created_at else ""
                
                is_fulfilled = status in ['SHIPPED', 'COMPLETED']
                
                if is_fulfilled:
                    fulfilled_list.append({"key": key, "display": display, "timestamp": timestamp})
                else:
                    pending_list.append({"key": key, "display": display})
            
            # Sort
            fulfilled_list.sort(key=lambda x: x['timestamp'], reverse=True)
            pending_list.sort(key=lambda x: x['display'])
            
            return {
                "success": True,
                "pendingList": pending_list,
                "fulfilledList": fulfilled_list
            }
            
        except Exception as e:
            logger.error(f"Error in get_initial_bol_data: {e}")
            return {"success": False, "pendingList": [], "fulfilledList": [], "message": str(e)}

    @staticmethod
    async def get_existing_bol_data(db: AsyncSession, po_sku_key: str):
        try:
            # 1. Get Order
            order_res = await db.execute(
                text("SELECT id, status FROM orders WHERE order_number = :key"),
                {"key": po_sku_key}
            )
            order = order_res.fetchone()
            
            if not order:
                return {"success": True, "bols": [], "actShipDate": None, "isFulfilled": False}
            
            order_id = order.id
            status = order.status
            
            # 2. Get Shipments
            ship_res = await db.execute(
                text("SELECT tracking_number, shipped_at, items FROM shipments WHERE order_id = :oid"),
                {"oid": order_id}
            )
            shipments = ship_res.fetchall()
            
            # 3. Map Data
            act_ship_date = None
            is_fulfilled = status in ['SHIPPED', 'COMPLETED']
            bols = []
            
            for s in shipments:
                shipped_at = s.shipped_at
                if not act_ship_date and shipped_at:
                    act_ship_date = shipped_at.isoformat().split('T')[0]
                
                raw_items = s.items # This should be a python dict/list if using SQLAlchemy JSON type, or str if text
                if isinstance(raw_items, str):
                    try:
                        items = json.loads(raw_items)
                    except:
                        items = []
                else:
                    items = raw_items if raw_items else []
                
                qty = 0
                if isinstance(items, list):
                    qty = sum((int(i.get('qty', 0)) for i in items))
                
                bols.append({
                    "bolNumber": s.tracking_number if s.tracking_number else "",
                    "shippedQty": qty,
                    "shippingFee": 0,
                    "signed": False
                })
                
            return {
                "success": True,
                "bols": bols,
                "actShipDate": act_ship_date,
                "isFulfilled": is_fulfilled
            }

        except Exception as e:
            logger.error(f"Error in get_existing_bol_data: {e}")
            return {"success": False, "bols": [], "message": str(e), "isFulfilled": False}

    @staticmethod
    async def save_bol_data(db: AsyncSession, payload: BolSaveRequest):
        try:
            # Transaction handled by caller presumably, or managed here?
            # In FastAPI, db session dependency handles transaction commit if we don't raise exception?
            # Actually, standard dependency is usually autocommit=False. We should commit explicitly.
            
            # 1. Get Order ID
            order_res = await db.execute(
                text("SELECT id FROM orders WHERE order_number = :key"),
                {"key": payload.poSkuKey}
            )
            order = order_res.fetchone()
            
            if not order:
                raise Exception(f"Order not found: {payload.poSkuKey}")
            
            order_id = order.id
            
            # 2. Delete existing shipments
            await db.execute(
                text("DELETE FROM shipments WHERE order_id = :oid"),
                {"oid": order_id}
            )
            
            # 3. Insert new shipments
            if payload.bols:
                for b in payload.bols:
                    if b.bolNumber:
                        # Prepare items JSON
                        items_json = json.dumps([{"qty": b.shippedQty}])
                        # Parse date
                        shipped_at = datetime.strptime(payload.actShipDate, "%Y-%m-%d")
                        
                        await db.execute(
                            text("""
                                INSERT INTO shipments (order_id, tracking_number, shipped_at, items) 
                                VALUES (:oid, :track, :date, :items)
                            """),
                            {
                                "oid": order_id,
                                "track": b.bolNumber,
                                "date": shipped_at,
                                "items": items_json  # asyncpg handles casting if param style is correct
                            }
                        )
            
            # 4. Update Order Status
            new_status = 'SHIPPED' if payload.isFulfilled else 'CONFIRMED'
            
            await db.execute(
                text("UPDATE orders SET status = :status, updated_at = NOW() WHERE id = :oid"),
                {"status": new_status, "oid": order_id}
            )
            
            await db.commit()
            return {"success": True, "message": f"Successfully saved for '{payload.poSkuKey}'."}

        except Exception as e:
            await db.rollback()
            logger.error(f"Error in save_bol_data: {e}")
            return {"success": False, "message": str(e)}
