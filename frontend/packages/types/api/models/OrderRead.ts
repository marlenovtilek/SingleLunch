/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrderItemRead } from './OrderItemRead';
import type { StatusEnum } from './StatusEnum';
export type OrderRead = {
    id?: string;
    daily_menu: string;
    readonly daily_menu_date: string;
    readonly payment_qr_url: string | null;
    status?: StatusEnum;
    total_amount?: string;
    readonly created_at: string;
    readonly items: Array<OrderItemRead>;
};

