"""
models.py
=========
SQLAlchemy ORM Models for normalized database tables.
"""

from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import uuid


class Order(Base):
    """Order model - corresponds to 'orders' table."""
    __tablename__ = "orders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(String, unique=True, nullable=False, index=True)
    source = Column(String, nullable=False, default="DEALER")
    status = Column(String, nullable=False, default="DRAFT")
    customer_info = Column(JSONB, nullable=True)
    external_id = Column(String, nullable=True)
    items = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship: One Order -> Many Shipments
    # lazy="selectin" is CRITICAL for async compatibility
    shipments = relationship(
        "Shipment",
        back_populates="order",
        lazy="selectin",
        cascade="all, delete-orphan"
    )


class Shipment(Base):
    """Shipment model - corresponds to 'shipments' table."""
    __tablename__ = "shipments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    tracking_number = Column(String, nullable=True)
    carrier = Column(String, nullable=True)
    shipped_at = Column(DateTime(timezone=True), nullable=False)
    items = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Back-reference to Order
    order = relationship("Order", back_populates="shipments")
