"""
bol.py (Router)
===============
FastAPI router for BOL API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.bol_service import BolService
from app.schemas import OrderRead, InitialDataResponse, ExistingDataResponse
from typing import List

router = APIRouter(prefix="/bol", tags=["BOL"])


@router.get("/initial-data", response_model=InitialDataResponse)
async def get_initial_data(db: AsyncSession = Depends(get_db)):
    """
    Get initial BOL data for dropdown population.
    Returns pending and fulfilled order lists.
    """
    return await BolService.get_initial_data(db)


@router.get("/orders", response_model=List[OrderRead])
async def get_orders(limit: int = 100, db: AsyncSession = Depends(get_db)):
    """
    Get all orders with their shipments.
    """
    return await BolService.get_orders(db, limit=limit)


@router.get("/{po_sku_key}", response_model=ExistingDataResponse)
async def get_existing_data(po_sku_key: str, db: AsyncSession = Depends(get_db)):
    """
    Get existing BOL data for a specific order.
    Returns BOL-formatted response for GAS client compatibility.
    """
    return await BolService.get_existing_data(db, po_sku_key)


@router.get("/detail/{po_sku_key}", response_model=OrderRead)
async def get_order_detail(po_sku_key: str, db: AsyncSession = Depends(get_db)):
    """
    Get full order details with shipments.
    Raises 404 if order not found.
    """
    order = await BolService.get_order_detail(db, po_sku_key)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Order '{po_sku_key}' not found")
    return order
