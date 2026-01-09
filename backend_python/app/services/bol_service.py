"""
bol_service.py
==============
Business Logic Layer for BOL operations.
Reads from normalized `orders` + `shipments` tables.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.models import Order, Shipment
from app.schemas import (
    OrderRead, ShipmentRead, OrderListItem,
    InitialDataResponse, ExistingDataResponse, BolItem
)
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


class BolService:
    """Service layer for BOL operations."""
    
    @staticmethod
    async def get_orders(db: AsyncSession, limit: int = 100) -> List[OrderRead]:
        """
        Fetch all orders with their shipments.
        
        Args:
            db: AsyncSession from dependency injection
            limit: Maximum number of orders to return
            
        Returns:
            List of OrderRead Pydantic models
        """
        try:
            stmt = (
                select(Order)
                .options(selectinload(Order.shipments))
                .order_by(Order.created_at.desc())
                .limit(limit)
            )
            
            result = await db.execute(stmt)
            orders = result.scalars().all()
            
            # Convert to Pydantic models
            return [
                OrderRead(
                    id=str(order.id),
                    order_number=order.order_number,
                    source=order.source,
                    status=order.status,
                    customer_info=order.customer_info,
                    items=order.items,
                    created_at=order.created_at,
                    updated_at=order.updated_at,
                    shipments=[
                        ShipmentRead(
                            id=str(s.id),
                            tracking_number=s.tracking_number,
                            carrier=s.carrier,
                            shipped_at=s.shipped_at,
                            items=s.items,
                            created_at=s.created_at
                        ) for s in order.shipments
                    ]
                ) for order in orders
            ]
            
        except Exception as e:
            logger.error(f"Error in get_orders: {e}")
            return []
    
    @staticmethod
    async def get_order_detail(db: AsyncSession, po_sku_key: str) -> Optional[OrderRead]:
        """
        Fetch a specific order by its order_number (po_sku_key).
        
        Args:
            db: AsyncSession from dependency injection
            po_sku_key: The order_number to search for
            
        Returns:
            OrderRead Pydantic model, or None if not found
        """
        try:
            stmt = (
                select(Order)
                .options(selectinload(Order.shipments))
                .where(Order.order_number == po_sku_key)
            )
            
            result = await db.execute(stmt)
            order = result.scalar_one_or_none()
            
            if order is None:
                return None
            
            return OrderRead(
                id=str(order.id),
                order_number=order.order_number,
                source=order.source,
                status=order.status,
                customer_info=order.customer_info,
                items=order.items,
                created_at=order.created_at,
                updated_at=order.updated_at,
                shipments=[
                    ShipmentRead(
                        id=str(s.id),
                        tracking_number=s.tracking_number,
                        carrier=s.carrier,
                        shipped_at=s.shipped_at,
                        items=s.items,
                        created_at=s.created_at
                    ) for s in order.shipments
                ]
            )
            
        except Exception as e:
            logger.error(f"Error in get_order_detail: {e}")
            return None
    
    @staticmethod
    async def get_initial_data(db: AsyncSession) -> InitialDataResponse:
        """
        Legacy method: Get orders grouped by status for GAS dropdown.
        """
        try:
            stmt = (
                select(Order)
                .order_by(Order.created_at.desc())
            )
            
            result = await db.execute(stmt)
            orders = result.scalars().all()
            
            pending_list = []
            fulfilled_list = []
            
            for order in orders:
                key = order.order_number
                status = order.status
                created_at = order.created_at
                
                display = f"{key} ({status})"
                timestamp = created_at.isoformat() if created_at else ""
                
                is_fulfilled = status in ['SHIPPED', 'COMPLETED']
                
                if is_fulfilled:
                    fulfilled_list.append(OrderListItem(key=key, display=display, timestamp=timestamp))
                else:
                    pending_list.append(OrderListItem(key=key, display=display))
            
            # Sort
            fulfilled_list.sort(key=lambda x: x.timestamp or "", reverse=True)
            pending_list.sort(key=lambda x: x.display)
            
            return InitialDataResponse(
                success=True,
                pendingList=pending_list,
                fulfilledList=fulfilled_list
            )
            
        except Exception as e:
            logger.error(f"Error in get_initial_data: {e}")
            return InitialDataResponse(success=False, message=str(e))
    
    @staticmethod
    async def get_existing_data(db: AsyncSession, po_sku_key: str) -> ExistingDataResponse:
        """
        Legacy method: Get BOL-formatted data for GAS client.
        """
        try:
            order = await BolService.get_order_detail(db, po_sku_key)
            
            if not order:
                return ExistingDataResponse(success=True, bols=[], actShipDate=None, isFulfilled=False)
            
            status = order.status
            shipments = order.shipments
            
            act_ship_date = None
            is_fulfilled = status in ['SHIPPED', 'COMPLETED']
            bols = []
            
            for s in shipments:
                shipped_at = s.shipped_at
                if not act_ship_date and shipped_at:
                    act_ship_date = shipped_at.isoformat().split('T')[0]
                
                items = s.items or {}
                qty = 0
                if isinstance(items, dict):
                    qty = int(items.get("qty", 0))
                elif isinstance(items, list):
                    qty = sum(int(i.get("qty", 0)) for i in items if isinstance(i, dict))
                
                bols.append(BolItem(
                    bolNumber=s.tracking_number or "",
                    shippedQty=qty,
                    shippingFee=0,
                    signed=False
                ))
            
            return ExistingDataResponse(
                success=True,
                bols=bols,
                actShipDate=act_ship_date,
                isFulfilled=is_fulfilled
            )
            
        except Exception as e:
            logger.error(f"Error in get_existing_data: {e}")
            return ExistingDataResponse(success=False, message=str(e))
