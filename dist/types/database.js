export var OrderSource;
(function (OrderSource) {
    OrderSource["DEALER"] = "DEALER";
    OrderSource["QUOTE"] = "QUOTE";
})(OrderSource || (OrderSource = {}));
export var OrderStatus;
(function (OrderStatus) {
    OrderStatus["DRAFT"] = "DRAFT";
    OrderStatus["CONFIRMED"] = "CONFIRMED";
    OrderStatus["ALLOCATING"] = "ALLOCATING";
    OrderStatus["PARTIALLY_SHIPPED"] = "PARTIALLY_SHIPPED";
    OrderStatus["SHIPPED"] = "SHIPPED";
    OrderStatus["COMPLETED"] = "COMPLETED";
    OrderStatus["CANCELLED"] = "CANCELLED";
})(OrderStatus || (OrderStatus = {}));
export var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["OPEN"] = "OPEN";
    InvoiceStatus["OVERDUE"] = "OVERDUE";
    InvoiceStatus["PAID"] = "PAID";
})(InvoiceStatus || (InvoiceStatus = {}));
