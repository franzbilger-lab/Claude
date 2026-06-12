# Nullstellenrechner für ganzrationale Funktionen

Eine mobile-freundliche Single-Page-Website (reines HTML/CSS/JavaScript, keine Abhängigkeiten),
die Nullstellen ganzrationaler Funktionen (Polynome) berechnet.

**Starten:** `index.html` einfach im Browser öffnen – kein Build, kein Server nötig.

## Funktionen

- **Eingabe als Funktionsterm**, z. B. `x^3 - 2x^2 - 5x + 6`, `2x³ − 8x` oder `0,5x^2 - 2`
  - Potenzen mit `^` oder Unicode-Hochzahlen (`²`, `³`, …)
  - Dezimalzahlen mit Komma oder Punkt
- **Exakte Lösung** für Grad 1 (lineare Gleichung) und Grad 2 (Mitternachtsformel mit Diskriminante)
- **Grad ≥ 3:** Ausklammern von `x^k`, Satz über rationale Nullstellen + Polynomdivision,
  Rest numerisch mit dem **Durand-Kerner-Verfahren** (inkl. Newton-Nachschärfung)
- Anzeige von **Vielfachheiten**, **komplexen Nullstellen** und **Brüchen** (z. B. `1/3 ≈ 0,333333`)
- **Lösungsweg** als aufklappbare Schritt-für-Schritt-Erklärung
- **Graph** der Funktion mit markierten Nullstellen (Canvas, passt sich der Bildschirmgröße an)
- **Mobile-friendly:** responsives Layout, große Touch-Ziele, Beispiel-Chips zum Antippen

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Struktur und Eingabemaske |
| `style.css` | Responsives Dark-Theme |
| `app.js` | Parser, Lösungsverfahren, Formatierung, Graph |

## Verbesserter Prompt

Die ursprüngliche Anfrage („Erstelle mir eine Website die Nullstellen von ganzrationalen
Funktionen löst … mobile friendly, JS") wurde zu dieser präziseren Aufgabenstellung verfeinert:

> Erstelle eine Single-Page-Website in reinem HTML, CSS und JavaScript (ohne Frameworks und
> ohne Build-Schritt), die Nullstellen ganzrationaler Funktionen beliebigen Grades berechnet.
>
> **Eingabe:** ein Funktionsterm wie `x^3 - 2x^2 - 5x + 6`; akzeptiere `^` und
> Unicode-Hochzahlen, Dezimalkomma und -punkt sowie implizite Multiplikation (`2x`).
> Zeige bei ungültiger Eingabe eine verständliche deutsche Fehlermeldung.
>
> **Berechnung:** Grad 1 und 2 exakt (lineare Umformung bzw. Mitternachtsformel mit
> Diskriminante); ab Grad 3 zuerst `x^k` ausklammern und rationale Nullstellen per
> Polynomdivision abspalten, den Rest numerisch lösen. Erkenne Vielfachheiten und gib
> auch komplexe Nullstellen aus, klar getrennt von den reellen.
>
> **Ausgabe:** die Nullstellen übersichtlich gelistet (Brüche, wo möglich), ein
> aufklappbarer Lösungsweg und ein Canvas-Graph der Funktion mit markierten Nullstellen.
>
> **UI:** komplett auf Deutsch, mobile-first und responsiv (Viewport-Meta, Touch-Ziele
> ≥ 44 px, flexible Karten-Layouts), mit antippbaren Beispiel-Funktionen zum Ausprobieren.
