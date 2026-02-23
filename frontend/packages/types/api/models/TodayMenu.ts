/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MenuOption } from './MenuOption';
export type TodayMenu = {
    readonly id: string;
    date: string;
    selection_deadline: string;
    readonly can_order: boolean;
    readonly payment_qr_url?: string | null;
    readonly options: Array<MenuOption>;
};

