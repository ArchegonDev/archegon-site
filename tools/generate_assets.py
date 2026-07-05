from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


SITE = Path(__file__).resolve().parents[1]
ASSETS = SITE / "assets"
ASSETS.mkdir(exist_ok=True)

INK = HexColor("#101418")
PAPER = HexColor("#f5f1ea")
EMBER = HexColor("#d66b35")
AMBER = HexColor("#f0b35a")
MUTED = HexColor("#665f56")
LINE = HexColor("#e2d8ca")
WHITE = HexColor("#fffaf1")

DISCLAIMER = (
    "Nothing in this document or on archegon.com constitutes an offer or invitation to invest, "
    "financial advice, or a financial promotion. Figures are illustrative, built from public "
    "benchmarks where stated, and subject to verification and due diligence."
)


def draw_wrapped(c, text, x, y, width_chars=86, size=10.5, leading=14, color=MUTED, font="Helvetica"):
    c.setFillColor(color)
    c.setFont(font, size)
    for paragraph in text.split("\n"):
        lines = wrap(paragraph, width_chars) or [""]
        for line in lines:
            c.drawString(x, y, line)
            y -= leading
        y -= leading * 0.35
    return y


def start_project_page(c, title, subtitle, page_number):
    w, h = A4
    margin = 48

    c.setFillColor(PAPER)
    c.rect(0, 0, w, h, stroke=0, fill=1)
    c.setStrokeColor(LINE)
    for offset in range(0, int(w), 36):
        c.line(offset, 0, offset, h)
    for offset in range(0, int(h), 36):
        c.line(0, offset, w, offset)

    c.setFillColor(INK)
    c.roundRect(margin, h - 170, w - margin * 2, 114, 8, stroke=0, fill=1)
    c.setFillColor(AMBER)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin + 24, h - 92, "ARCHEGON PUBLIC PROJECT SUMMARY")
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 26)
    c.drawString(margin + 24, h - 126, title)
    c.setFont("Helvetica", 11.5)
    c.drawString(margin + 24, h - 150, subtitle)

    c.setStrokeColor(EMBER)
    c.setLineWidth(3)
    c.line(margin, 86, margin, 48)
    draw_wrapped(c, DISCLAIMER, margin + 14, 80, width_chars=90, size=8.4, leading=10.5, color=MUTED)

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(margin, 28, f"archegon.com | hello@archegon.com | Public discussion draft | Page {page_number}")

    return h - 212


def add_heading(c, label, y, margin=48):
    c.setFillColor(EMBER)
    c.setFont("Helvetica-Bold", 12.5)
    c.drawString(margin, y, label)
    return y - 22


def add_bullets(c, bullets, y, margin=48, width_chars=79):
    for bullet in bullets:
        c.setFillColor(EMBER)
        c.circle(margin + 4, y + 4, 2.5, stroke=0, fill=1)
        y = draw_wrapped(c, bullet, margin + 18, y, width_chars=width_chars, size=10.2, leading=13.5, color=INK)
        y -= 3
    return y


def draw_project_summary(path, title, subtitle, summary, sections, what_archegon_seeks, private_note):
    c = canvas.Canvas(str(path), pagesize=A4)
    margin = 48
    page = 1
    y = start_project_page(c, title, subtitle, page)

    y = add_heading(c, "Public framing", y)
    y = draw_wrapped(c, summary, margin, y, width_chars=84, size=10.8, leading=14.5, color=INK)

    y -= 10
    for section_title, bullets in sections:
        if y < 190:
            c.showPage()
            page += 1
            y = start_project_page(c, title, subtitle, page)
        y = add_heading(c, section_title, y)
        y = add_bullets(c, bullets, y)
        y -= 7

    if y < 235:
        c.showPage()
        page += 1
        y = start_project_page(c, title, subtitle, page)
    y = add_heading(c, "What Archegon is seeking", y)
    y = add_bullets(c, what_archegon_seeks, y)

    y -= 9
    y = add_heading(c, "Financial model and diligence", y)
    y = draw_wrapped(c, private_note, margin, y, width_chars=84, size=10.2, leading=13.5, color=MUTED)

    c.showPage()
    c.save()


def load_font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_og_card():
    img = Image.new("RGB", (1200, 630), "#101418")
    draw = ImageDraw.Draw(img)
    for radius, color in [(520, "#3a211d"), (430, "#5d2f24"), (340, "#8f4f34"), (250, "#d66b35"), (160, "#f0b35a")]:
        draw.ellipse((780 - radius, 445 - radius, 780 + radius, 445 + radius), outline=color, width=3)
    for x in range(0, 1200, 48):
        draw.line((x, 0, x, 630), fill="#1a2428", width=1)
    for y in range(0, 630, 48):
        draw.line((0, y, 1200, y), fill="#1a2428", width=1)

    draw.text((72, 74), "ARCHEGON", fill="#f0b35a", font=load_font(34, True))
    draw.text((72, 166), "Bringing compute\nto the heat.", fill="#fffaf1", font=load_font(74, True), spacing=8)
    draw.text(
        (76, 400),
        "Geothermal-powered data centres - firm clean power for AI inference.",
        fill="#d9d1c5",
        font=load_font(28),
    )
    draw.line((76, 512, 420, 512), fill="#d66b35", width=6)
    draw.text(
        (76, 536),
        "Investor and partner interest only - not an investment offer.",
        fill="#d9d1c5",
        font=load_font(20),
    )
    img.save(ASSETS / "og-card.png", quality=92)


def main():
    draw_project_summary(
        ASSETS / "archegon-new-zealand-project-brief.pdf",
        "New Zealand Project Summary",
        "Geothermal-anchored AI inference campus",
        "Archegon is exploring a grid-connected, geothermal-anchored AI inference campus in New "
        "Zealand. The public thesis is simple: AI infrastructure increasingly needs firm clean "
        "power, geothermal naturally matches a 24/7 compute load, and New Zealand offers an "
        "operating geothermal context that could support a buildable first route. This summary "
        "generalises the source business plan for qualified conversations only.",
        [
            (
                "Route thesis",
                [
                    "A preliminary 100 MW Phase 1 campus concept, with longer-term expansion potential subject to grid, power, land, consent, fibre, water, tenant, and financing diligence.",
                    "Power strategy centred on a long-term firm-geothermal commercial arrangement rather than speculative merchant exposure.",
                    "Target use case is AI inference and other steady workloads that value reliable low-carbon capacity and speed-to-power.",
                ],
            ),
            (
                "Why New Zealand",
                [
                    "Existing geothermal operating base, high renewable grid share, temperate climate, and credible infrastructure institutions create a lower-variance route than first-of-a-kind frontier resource development.",
                    "Candidate paths include Central North Island geothermal proximity and Southland-style colder-climate infrastructure routes; both require site-specific diligence before claims are made.",
                    "The country-level opportunity is framed as a partner-led infrastructure conversation, not a public investment invitation.",
                ],
            ),
            (
                "Development path",
                [
                    "Stage 1: confirm energy partner, site, fibre, water, consenting route, demand case, and preliminary engineering.",
                    "Stage 2: secure anchor tenant or strategic partner interest, complete feasibility, and move to investment-grade diligence.",
                    "Stage 3: pursue phased campus delivery only after the assumptions have been validated by qualified technical, legal, and financial parties.",
                ],
            ),
            (
                "Key diligence workstreams",
                [
                    "Power price, CPPA bankability, grid connection, curtailment exposure, and counterparty credit quality.",
                    "Land, iwi and community engagement, environmental consent, water, cooling, construction logistics, and fibre resilience.",
                    "Tenant concentration, data-centre capex, AI hardware ownership model, contracting structure, foreign investment rules, FX, and construction inflation.",
                ],
            ),
        ],
        [
            "Expressions of interest from infrastructure investors, energy partners, AI compute customers, data-centre operators, technical co-founders, and advisors.",
            "Feedback on the site-screening approach, commercial structure, consenting pathway, and how to make the opportunity credible for an investment-grade diligence process.",
            "Qualified conversations that may lead to a separate controlled diligence review.",
        ],
        "The underlying source plan contains capital-cost ranges, revenue assumptions, scenario analyses, and staged capital requirements. Those figures are not published here because they require verification, legal review, and a qualified diligence process. Detailed financial material should be shared separately only with appropriate parties.",
    )

    draw_project_summary(
        ASSETS / "archegon-australia-project-brief.pdf",
        "Australia Project Summary",
        "Off-grid Cooper Basin AI inference hub",
        "Archegon is exploring a higher-risk Australian route: an off-grid, behind-the-meter AI "
        "inference hub in the Cooper Basin, combining enhanced geothermal systems, solar, "
        "storage, dry cooling, and resilient connectivity. The public thesis is that remote firm "
        "clean power can become useful when the compute load moves to the resource instead of "
        "waiting for transmission. This summary generalises the source business plan for "
        "qualified conversations only.",
        [
            (
                "Route thesis",
                [
                    "Cooper Basin hot-dry-rock geology creates a frontier option on large-scale firm clean power, but commercial-scale reservoir performance remains the central risk.",
                    "The intended model is vertically integrated and behind the meter: geothermal baseload, solar support, storage, cooling, fibre or redundant backhaul, and modular data-centre capacity.",
                    "The route is explicitly milestone-gated; no large-scale build should proceed until subsurface, water, cooling, connectivity, offtake, and financing risks are materially de-risked.",
                ],
            ),
            (
                "Why Australia",
                [
                    "The Cooper Basin has historic geothermal proof points and very hot granite, while the remote location historically made power export difficult.",
                    "AI inference and other latency-tolerant workloads could change the economics by bringing demand to the power source.",
                    "Potential co-products and land-use ideas, including lithium brine analysis and agrivoltaic land use, are treated as research-stage upside rather than base-case economics.",
                ],
            ),
            (
                "Development path",
                [
                    "Phase 0: resource confirmation, pilot well design, water and cooling strategy, tenure, environmental route, connectivity plan, and customer discovery.",
                    "Phase 1: only if the pilot validates the reservoir and commercial gates, pursue a first modular campus with anchor demand and project-finance-ready diligence.",
                    "Later phases would use repeatable blocks only after well productivity, cooling performance, logistics, contracting, and cost data are proven.",
                ],
            ),
            (
                "Key diligence workstreams",
                [
                    "EGS reservoir productivity, drilling cost curve, induced-seismicity controls, reinjection, and long-term resource performance.",
                    "Water availability, dry and radiative cooling performance, desert construction logistics, fibre resilience, LEO redundancy, and operational staffing.",
                    "Capital intensity, anchor customer structure, grants or public finance, strategic partners, regulatory tenure, FX, insurance, and first-of-a-kind execution risk.",
                ],
            ),
        ],
        [
            "Expressions of interest from geothermal developers, subsurface experts, infrastructure capital, hyperscale or AI compute customers, energy partners, and Australian policy or grants specialists.",
            "Technical review of whether the Fervo-style EGS playbook, cooling architecture, and connectivity route can be adapted credibly to the Cooper Basin.",
            "Qualified conversations that may lead to a separate controlled diligence review.",
        ],
        "The underlying source plan contains pilot capital requirements, Phase 1 capex ranges, scenario analyses, capital-stack scenarios, sensitivity tables, and exit analysis. Those figures are not published here because the opportunity is first-of-a-kind and requires technical validation, legal review, and a qualified diligence process before any investment discussion.",
    )

    draw_og_card()


if __name__ == "__main__":
    main()
