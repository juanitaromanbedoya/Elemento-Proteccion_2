from django.shortcuts import render
from django.conf import settings


def login_view(request):
    return render(request, "epp_app/login.html", {"api_base_url": settings.API_BASE_URL})


def register_view(request):
    return render(request, "epp_app/register.html", {"api_base_url": settings.API_BASE_URL})


def camera_view(request):
    return render(request, "epp_app/camera.html", {"api_base_url": settings.API_BASE_URL})