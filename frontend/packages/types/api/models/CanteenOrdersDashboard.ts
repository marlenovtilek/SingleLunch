/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CanteenOrderItemTotal } from './CanteenOrderItemTotal';
import type { CanteenOrderRead } from './CanteenOrderRead';
export type CanteenOrdersDashboard = {
    date: string;
    orders_count: number;
    paid_count: number;
    awaiting_payment_count: number;
    cancelled_count: number;
    missed_deadline_count: number;
    total_paid_amount: string;
    orders: Array<CanteenOrderRead>;
    confirmed_item_totals: Array<CanteenOrderItemTotal>;
};

