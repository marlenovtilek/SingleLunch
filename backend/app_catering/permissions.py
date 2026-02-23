from rest_framework.permissions import BasePermission


class IsCanteenOrAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        return bool(
            user.is_superuser
            or user.is_staff
            or getattr(user, "role", None) == "CANTEEN"
        )
