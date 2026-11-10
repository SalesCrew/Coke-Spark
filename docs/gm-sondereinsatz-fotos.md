# Fotos bei GM-Sondereinsätzen

Sondereinsätze können mehrere optionale Fotos enthalten. Kamera und Galerie sind direkt in der bestehenden Zusatzzeiterfassung erreichbar, bei Live- und manueller Erfassung. Optional können die vorhandenen Foto-Tags pro Bild ausgewählt werden. Es gibt keine Pflicht-Tags und keine neue Fragebogenkampagne.

Vor dem Start ausgewählte Fotos und Tags werden im Browser im jeweiligen Benutzerkontext zwischengespeichert. Beim Start beziehungsweise manuellen Speichern werden sie an denselben Zeiteintrag gebunden. Fehlgeschlagene Übertragungen werden mit derselben Foto-ID erneut versucht. Das Abschließen wartet auf die Übertragung; ein verlorener Upload-Response erzeugt keinen zweiten Fotodatensatz. Die Zeiterfassung lässt sich danach über denselben Eintrag fortsetzen.

Bilder können aus der heutigen Übersicht und „Meine Zeiten“ geöffnet und ergänzt werden. In der Admin-Zeiterfassung gibt es den Foto-Einstieg am Sondereinsatz. Der Backend-Zugriff ist auf den zuständigen GM und vollständige Admins begrenzt. Ein GM kann keine Fotos anderer GMs abrufen. SMs und Kundenzugänge haben keinen Zugriff auf diese Endpunkte.

Die Speicherung verwendet den privaten Bucket `gm-time-entry-photos` sowie `time_tracking_entry_photos` und `time_tracking_entry_photo_tags`. Bildlinks sind zeitlich begrenzt. Der Bucket ist über normale Client-JWTs nicht direkt zugänglich. Bilder werden nie überschrieben; Entfernen setzt eine Löschmarkierung und bewahrt Originaldatei und Metadaten. Tag-Bezeichnungen bleiben als historische Momentaufnahme erhalten. Tag-Änderungen prüfen die aktuelle Foto-Version.

Migration: `backend/supabase/migrations/20261110151935_gm_special_assignment_photos.sql`. Sie ergänzt zwei Tabellen, deren Zugriffsschutz und einen privaten Bucket. Bestehende Zeiteinträge, Fragebogenantworten, Fotos und Foto-Tag-Definitionen werden nicht umgeschrieben.

Geprüft mit einer isolierten PGlite-Datenbank und synthetischen Dateien: Zugriffsregeln, optionale Tags, gleichzeitige Versionsänderungen, Upload-Wiederholung nach verlorener Antwort, Fortsetzen nach Neuladen, Kommentarbeibehaltung, manuelle Erfassung und Öffnen aus „Meine Zeiten“. Browser-Prüfung in Chromium und WebKit in iPad-Größe. Frontend-Produktionsbuild und Backend-Typprüfung erfolgreich.
