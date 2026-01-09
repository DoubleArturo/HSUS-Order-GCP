"""
schemas.py
==========
Pydantic models for API request/response serialization.
"""

from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Any
from datetime import datetime


class ShipmentRead(BaseModel):
    """Pydantic schema for Shipment output."""
    id: str
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    shipped_at: Optional[datetime] = None
    items: Optional[Any] = None
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class OrderRead(BaseModel):
    """Pydantic schema for Order output with nested shipments."""
    id: str
    order_number: str
    source: str
    status: str
    customer_info: Optional[Any] = None
    items: Optional[Any] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    shipments: List[ShipmentRead] = []
    
    model_config = ConfigDict(from_attributes=True)


class OrderListItem(BaseModel):
    """Simplified order for list views."""
    key: str
    display: str
    timestamp: Optional[str] = None


class InitialDataResponse(BaseModel):
    """Response format for initial data endpoint (legacy GAS compatibility)."""
    success: bool
    pendingList: List[OrderListItem] = []
    fulfilledList: List[OrderListItem] = []
    message: Optional[str] = None


class BolItem(BaseModel):
    """BOL item structure for legacy compatibility."""
    bolNumber: str
    shippedQty: int
    shippingFee: float = 0
    signed: bool = False


class ExistingDataResponse(BaseModel):
    """Response format for existing data endpoint (legacy GAS compatibility)."""
    success: bool
    bols: List[BolItem] = []
    actShipDate: Optional[str] = None
    isFulfilled: bool = False
    message: Optional[str] = None
