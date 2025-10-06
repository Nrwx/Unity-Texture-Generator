def detect_cairosvg():
    try:
        cairosvg.svg2png(bytestring=b"<svg><rect width='100' height='100' fill='red'/></svg>", write_to="test.png")
        logging.info("✅ CairoSVG funktioniert korrekt (test.png erstellt).")
    except Exception as e:
        logging.error(f"❌ CairoSVG Fehler: {e}")