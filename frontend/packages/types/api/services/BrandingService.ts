/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BrandingPaymentQrUpload } from '../models/BrandingPaymentQrUpload';
import type { BrandingSettings } from '../models/BrandingSettings';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class BrandingService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * @returns BrandingSettings
     * @throws ApiError
     */
    public brandingRetrieve(): CancelablePromise<BrandingSettings> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/branding/',
        });
    }
    /**
     * @param formData
     * @returns BrandingSettings
     * @throws ApiError
     */
    public brandingPaymentQrCreate(
        formData?: BrandingPaymentQrUpload,
    ): CancelablePromise<BrandingSettings> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/branding/payment-qr/',
            formData: formData,
            mediaType: 'multipart/form-data',
        });
    }
}
