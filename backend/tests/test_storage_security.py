import uuid

import pytest

from app import storage


@pytest.mark.parametrize("name", ["../../escape.jpg", "/tmp/escape.jpg", r"C:\temp\escape.jpg", r"..\escape.jpg", "results.json", "..", ""])
def test_upload_stays_inside_job(tmp_path, monkeypatch, name):
    monkeypatch.setattr(storage.settings, "temp_dir", str(tmp_path))
    job_id = str(uuid.uuid4())
    path = storage.save_upload(job_id, name, b"first")
    other = storage.save_upload(job_id, name, b"second")
    assert path.parent == tmp_path / job_id
    assert other != path
    assert path.read_bytes() == b"first"
    assert other.read_bytes() == b"second"
    assert path.name != "results.json"


def test_job_id_cannot_escape_storage(tmp_path, monkeypatch):
    monkeypatch.setattr(storage.settings, "temp_dir", str(tmp_path))
    with pytest.raises(ValueError):
        storage.save_upload("../../escape", "image.jpg", b"photo")
    assert not list(tmp_path.iterdir())
