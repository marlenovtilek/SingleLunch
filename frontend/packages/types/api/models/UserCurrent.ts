/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RoleEnum } from './RoleEnum';
export type UserCurrent = {
    /**
     * Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.
     */
    readonly username: string;
    first_name?: string;
    last_name?: string;
    birth_date?: string | null;
    phone_number?: string | null;
    department?: string | null;
    readonly department_name: string | null;
    telegram_id?: string | null;
    mattermost_id?: string | null;
    readonly role: RoleEnum;
    /**
     * Designates whether the user can log into this admin site.
     */
    readonly is_staff: boolean;
    /**
     * Designates that this user has all permissions without explicitly assigning them.
     */
    readonly is_superuser: boolean;
};
