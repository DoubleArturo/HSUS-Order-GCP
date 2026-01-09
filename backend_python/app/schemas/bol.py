from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Any

# --- Shared Models ---
class BolItem(BaseModel):
    bolNumber: str
    shippedQty: int
    shippingFee: float = 0
    signed: bool = False

class PendingOrder(BaseModel):
    key: str
    display: str

class FulfilledOrder(BaseModel):
    key: str
    display: str
    timestamp: Optional[str] = None # ISO format string

# --- Response Models ---
class BolInitialDataResponse(BaseModel):
    success: bool
    pendingList: List[PendingOrder]
    fulfilledList: List[FulfilledOrder]
    message: Optional[str] = None

class BolExistingDataResponse(BaseModel):
    success: bool
    bols: List[BolItem]
    actShipDate: Optional[str] = None
    isFulfilled: bool
    message: Optional[str] = None

# --- Request Models ---
class BolSaveRequest(BaseModel):
    poSkuKey: str
    actShipDate: str # YYYY-MM-DD expected
    isFulfilled: bool
    bols: List[BolItem]

class BolSaveResponse(BaseModel):
    success: bool
    message: str
