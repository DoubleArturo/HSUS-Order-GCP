from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db
from app.services.bol_service import BolService
from app.schemas.bol import (
    BolInitialDataResponse, 
    BolExistingDataResponse, 
    BolSaveRequest, 
    BolSaveResponse
)

router = APIRouter(prefix="/api/bol", tags=["BOL"])

@router.get("/initial-data", response_model=BolInitialDataResponse)
async def get_initial_data(db: AsyncSession = Depends(get_db)):
    """
    Fetch list of pending/fulfilled orders.
    """
    return await BolService.get_initial_bol_data(db)

@router.get("/{po_sku_key}", response_model=BolExistingDataResponse)
async def get_existing_data(po_sku_key: str, db: AsyncSession = Depends(get_db)):
    """
    Fetch specific order/shipment details.
    """
    return await BolService.get_existing_bol_data(db, po_sku_key)

@router.post("/save", response_model=BolSaveResponse, status_code=status.HTTP_201_CREATED)
async def save_data(payload: BolSaveRequest, db: AsyncSession = Depends(get_db)):
    """
    Save BOL data (Shipments & Status).
    """
    result = await BolService.save_bol_data(db, payload)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
        
    return result
