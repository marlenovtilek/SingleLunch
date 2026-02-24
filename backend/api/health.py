from django.db import connections
from django.http import JsonResponse


def healthz(_request):
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        return JsonResponse({"status": "error"}, status=503)

    return JsonResponse({"status": "ok"}, status=200)
