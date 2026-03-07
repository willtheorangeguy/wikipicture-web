"""Generate a self-contained HTML report from WikiPicture results."""

from __future__ import annotations

import html
from typing import Any


def _score_color(score: float) -> str:
    if score >= 0.7:
        return "#22c55e"  # green
    if score >= 0.4:
        return "#f59e0b"  # amber
    return "#ef4444"  # red


def _recommendation_badge(rec: str) -> str:
    colors = {
        "highly_recommended": ("#dcfce7", "#166534"),
        "recommended": ("#d1fae5", "#065f46"),
        "maybe": ("#fef9c3", "#854d0e"),
        "not_recommended": ("#fee2e2", "#991b1b"),
    }
    bg, fg = colors.get(rec, ("#f3f4f6", "#374151"))
    label = rec.replace("_", " ").title()
    return (
        f'<span style="background:{bg};color:{fg};padding:2px 8px;border-radius:9999px;'
        f'font-size:0.75rem;font-weight:600;">{html.escape(label)}</span>'
    )


def _opportunity_card(opp: dict[str, Any], index: int) -> str:
    filename = html.escape(opp.get("filename", "Unknown"))
    location = html.escape(opp.get("location_name", ""))
    score = float(opp.get("score", 0))
    rec = opp.get("recommendation", "")
    reasons: list[str] = opp.get("reasons", [])
    article: dict | None = opp.get("best_article")
    quality: dict | None = opp.get("quality")
    commons: dict | None = opp.get("commons")
    thumb_b64: str | None = opp.get("thumbnail_b64")
    lat = opp.get("latitude", 0)
    lon = opp.get("longitude", 0)

    thumb_html = ""
    if thumb_b64:
        thumb_html = (
            f'<img src="data:image/jpeg;base64,{thumb_b64}" '
            f'alt="{filename}" style="width:100%;height:160px;object-fit:cover;'
            f'border-radius:6px;display:block;margin-bottom:12px;">'
        )

    reasons_html = "".join(
        f'<li style="margin:2px 0;">{html.escape(r)}</li>' for r in reasons
    )

    article_html = ""
    if article:
        art_title = html.escape(article.get("title", ""))
        art_url = html.escape(article.get("url", "#"))
        img_count = article.get("image_count", 0)
        needs = article.get("needs_photo", False)
        needs_badge = (
            '<span style="color:#166534;font-weight:600;">✓ Needs photos</span>'
            if needs
            else '<span style="color:#6b7280;">Has photos</span>'
        )
        article_html = f"""
        <div style="margin-top:10px;padding:8px;background:#f8fafc;border-radius:6px;font-size:0.85rem;">
          <strong>Wikipedia:</strong>
          <a href="{art_url}" target="_blank" rel="noopener">{art_title}</a><br>
          Images: {img_count} &nbsp;|&nbsp; {needs_badge}
        </div>"""

    meta_parts = []
    if quality:
        mp = quality.get("megapixels", 0)
        suitable = quality.get("overall_suitable", False)
        meta_parts.append(f"{mp:.1f} MP")
        meta_parts.append("✓ Suitable" if suitable else "✗ Low quality")
    if commons:
        sat = html.escape(commons.get("saturation", ""))
        nearby = commons.get("nearby_image_count", 0)
        meta_parts.append(f"Commons: {sat} ({nearby} nearby)")

    meta_html = (
        f'<p style="font-size:0.8rem;color:#6b7280;margin:6px 0 0;">'
        + " &nbsp;·&nbsp; ".join(meta_parts)
        + "</p>"
        if meta_parts
        else ""
    )

    score_pct = int(score * 100)
    score_col = _score_color(score)

    return f"""
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;
              padding:16px;display:flex;flex-direction:column;gap:4px;">
    {thumb_html}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
      <span style="font-weight:600;font-size:0.95rem;word-break:break-all;">{filename}</span>
      <span style="font-size:1.1rem;font-weight:700;color:{score_col};white-space:nowrap;">
        {score_pct}%
      </span>
    </div>
    <p style="margin:2px 0;font-size:0.85rem;color:#374151;">📍 {location}</p>
    <p style="margin:2px 0;font-size:0.8rem;color:#9ca3af;">
      {lat:.5f}, {lon:.5f}
    </p>
    {_recommendation_badge(rec)}
    <ul style="margin:6px 0 0 16px;padding:0;font-size:0.85rem;color:#374151;">
      {reasons_html}
    </ul>
    {article_html}
    {meta_html}
  </div>"""


def generate_report(results: dict[str, Any]) -> str:
    """Return a self-contained HTML string for the given results dict."""
    job_id = html.escape(results.get("job_id", ""))
    total = results.get("total_photos", 0)
    opportunities: list[dict] = results.get("opportunities", [])

    cards_html = "\n".join(
        _opportunity_card(opp, i) for i, opp in enumerate(opportunities)
    )

    top_score = max((float(o.get("score", 0)) for o in opportunities), default=0)
    recommended_count = sum(
        1
        for o in opportunities
        if o.get("recommendation") in ("highly_recommended", "recommended")
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WikiPicture Report</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; }}
    body {{
      font-family: system-ui, -apple-system, sans-serif;
      background: #f9fafb;
      color: #111827;
      margin: 0;
      padding: 24px 16px;
    }}
    h1 {{ margin: 0 0 4px; font-size: 1.6rem; }}
    .summary {{
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin: 16px 0 24px;
    }}
    .stat {{
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px 20px;
      text-align: center;
      min-width: 110px;
    }}
    .stat-value {{ font-size: 1.8rem; font-weight: 700; }}
    .stat-label {{ font-size: 0.8rem; color: #6b7280; }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }}
    a {{ color: #2563eb; }}
    footer {{
      margin-top: 32px;
      font-size: 0.8rem;
      color: #9ca3af;
      text-align: center;
    }}
  </style>
</head>
<body>
  <h1>WikiPicture Report</h1>
  <p style="color:#6b7280;margin:0;">Job ID: <code>{job_id}</code></p>

  <div class="summary">
    <div class="stat">
      <div class="stat-value">{total}</div>
      <div class="stat-label">Photos analysed</div>
    </div>
    <div class="stat">
      <div class="stat-value">{len(opportunities)}</div>
      <div class="stat-label">Opportunities found</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color:#22c55e;">{recommended_count}</div>
      <div class="stat-label">Recommended</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color:{_score_color(top_score)};">{int(top_score * 100)}%</div>
      <div class="stat-label">Top score</div>
    </div>
  </div>

  <div class="grid">
    {cards_html}
  </div>

  <footer>Generated by <strong>WikiPicture</strong> v0.2.1</footer>
</body>
</html>"""
