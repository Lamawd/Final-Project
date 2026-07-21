def test_register_user(client):
    response = client.post(
        "/auth/register",
        json={"username": "testuser", "email": "testuser@example.com", "password": "testpassword123"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "testuser"
    assert "id" in data


def test_register_duplicate_email(client):
    client.post(
        "/auth/register",
        json={"username": "testuser1", "email": "test@example.com", "password": "password123"},
    )
    response = client.post(
        "/auth/register",
        json={"username": "testuser2", "email": "test@example.com", "password": "password123"},
    )
    assert response.status_code == 400
    assert "already" in response.json()["detail"].lower()


def test_login_success(client):
    client.post(
        "/auth/register",
        json={"username": "testuser", "email": "test@example.com", "password": "password123"},
    )
    response = client.post(
        "/auth/login",
        data={"username": "test@example.com", "password": "password123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_credentials(client):
    response = client.post(
        "/auth/login",
        data={"username": "nonexistent@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401


def test_get_me(client):
    # Register and login to get token
    client.post(
        "/auth/register",
        json={"username": "me", "email": "me@example.com", "password": "password123"},
    )
    login_resp = client.post(
        "/auth/login",
        data={"username": "me@example.com", "password": "password123"},
    )
    token = login_resp.json()["access_token"]

    # Request /auth/me with auth header
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "me"
    assert data["email"] == "me@example.com"
    assert data["is_admin"] is False
