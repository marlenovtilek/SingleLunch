/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CanteenMenuPaymentQRUpload } from '../models/CanteenMenuPaymentQRUpload';
import type { CanteenMenuSummary } from '../models/CanteenMenuSummary';
import type { CanteenMenuUpsert } from '../models/CanteenMenuUpsert';
import type { CanteenOrdersDashboard } from '../models/CanteenOrdersDashboard';
import type { DutyAssignee } from '../models/DutyAssignee';
import type { DutyAssignment } from '../models/DutyAssignment';
import type { DutyAssignmentUpsert } from '../models/DutyAssignmentUpsert';
import type { DutyCalendarResponse } from '../models/DutyCalendarResponse';
import type { OrderCreate } from '../models/OrderCreate';
import type { OrderPayment } from '../models/OrderPayment';
import type { OrderRead } from '../models/OrderRead';
import type { PaginatedOrderReadList } from '../models/PaginatedOrderReadList';
import type { TodayMenu } from '../models/TodayMenu';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class V1Service {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * @param date Дата меню в формате YYYY-MM-DD. По умолчанию сегодня.
     * @returns TodayMenu
     * @throws ApiError
     */
    public v1CanteenMenuRetrieve(
        date?: string,
    ): CancelablePromise<TodayMenu> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/canteen/menu/',
            query: {
                'date': date,
            },
        });
    }
    /**
     * @param requestBody
     * @returns TodayMenu
     * @throws ApiError
     */
    public v1CanteenMenuUpdate(
        requestBody: CanteenMenuUpsert,
    ): CancelablePromise<TodayMenu> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/v1/canteen/menu/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param requestBody
     * @returns TodayMenu
     * @throws ApiError
     */
    public v1CanteenMenuEditUpdate(
        requestBody: CanteenMenuUpsert,
    ): CancelablePromise<TodayMenu> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/v1/canteen/menu/edit/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param formData
     * @returns TodayMenu
     * @throws ApiError
     */
    public v1CanteenMenuPaymentQrCreate(
        formData: CanteenMenuPaymentQRUpload,
    ): CancelablePromise<TodayMenu> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/canteen/menu/payment-qr/',
            formData: formData,
            mediaType: 'multipart/form-data',
        });
    }
    /**
     * @param dateFrom Начальная дата периода (YYYY-MM-DD). По умолчанию: сегодня - 7 дней.
     * @param dateTo Конечная дата периода (YYYY-MM-DD). По умолчанию: сегодня + 14 дней.
     * @returns CanteenMenuSummary
     * @throws ApiError
     */
    public v1CanteenMenusList(
        dateFrom?: string,
        dateTo?: string,
    ): CancelablePromise<Array<CanteenMenuSummary>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/canteen/menus/',
            query: {
                'date_from': dateFrom,
                'date_to': dateTo,
            },
        });
    }
    /**
     * @param date Дата в формате YYYY-MM-DD. По умолчанию сегодня.
     * @returns CanteenOrdersDashboard
     * @throws ApiError
     */
    public v1CanteenOrdersRetrieve(
        date?: string,
    ): CancelablePromise<CanteenOrdersDashboard> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/canteen/orders/',
            query: {
                'date': date,
            },
        });
    }
    /**
     * @param month Месяц в формате YYYY-MM. По умолчанию текущий месяц.
     * @returns DutyCalendarResponse
     * @throws ApiError
     */
    public v1DutyRetrieve(
        month?: string,
    ): CancelablePromise<DutyCalendarResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/duty/',
            query: {
                'month': month,
            },
        });
    }
    /**
     * @param requestBody
     * @returns DutyAssignment
     * @throws ApiError
     */
    public v1DutyAssignUpdate(
        requestBody: DutyAssignmentUpsert,
    ): CancelablePromise<DutyAssignment> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/v1/duty/assign/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @returns DutyAssignee
     * @throws ApiError
     */
    public v1DutyAssigneesList(): CancelablePromise<Array<DutyAssignee>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/duty/assignees/',
        });
    }
    /**
     * @returns TodayMenu
     * @throws ApiError
     */
    public v1MenuTodayRetrieve(): CancelablePromise<TodayMenu> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/menu/today/',
        });
    }
    /**
     * @param requestBody
     * @returns OrderRead
     * @throws ApiError
     */
    public v1OrdersCreate(
        requestBody: OrderCreate,
    ): CancelablePromise<OrderRead> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/orders/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns OrderRead
     * @throws ApiError
     */
    public v1OrdersCancelCreate(
        id: string,
    ): CancelablePromise<OrderRead> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/orders/{id}/cancel/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Создание платежа
     * @param id
     * @param formData
     * @returns OrderPayment
     * @throws ApiError
     */
    public v1OrdersPaymentCreate(
        id: string,
        formData: OrderPayment,
    ): CancelablePromise<OrderPayment> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/orders/{id}/payment/',
            path: {
                'id': id,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
        });
    }
    /**
     * @param page A page number within the paginated result set.
     * @returns PaginatedOrderReadList
     * @throws ApiError
     */
    public v1OrdersMyList(
        page?: number,
    ): CancelablePromise<PaginatedOrderReadList> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/orders/my/',
            query: {
                'page': page,
            },
        });
    }
}
