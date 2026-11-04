import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

interface CalendarEvent {
  id: number;
  title: string;
  subtitle: string | null;
  type: string;        // CONCERT | PREMIERE | OTHER
  category: string;   // ROCK | POP | METAL | LATIN | DISNEY | ANIME | MARVEL | OTHER
  eventDate: string;  // YYYY-MM-DD
  eventTime: string | null;
  venue: string | null;
  city: string | null;
  description: string | null;
  imageUrl: string | null;
  ticketUrl: string | null;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  ROCK:   { label: 'Rock',    color: '#dc2626', bg: '#fee2e2', emoji: '🎸' },
  POP:    { label: 'Pop',     color: '#7c3aed', bg: '#ede9fe', emoji: '🎤' },
  METAL:  { label: 'Metal',   color: '#374151', bg: '#f3f4f6', emoji: '🤘' },
  LATIN:  { label: 'Latino',  color: '#ea580c', bg: '#ffedd5', emoji: '💃' },
  DISNEY: { label: 'Disney',  color: '#e020c8', bg: '#f8e4f8', emoji: '🏰' },
  ANIME:  { label: 'Anime',   color: '#db2777', bg: '#fce7f3', emoji: '⚔️' },
  MARVEL: { label: 'Marvel',  color: '#b91c1c', bg: '#fee2e2', emoji: '🦸' },
  OTHER:  { label: 'Otro',    color: '#6b7280', bg: '#f9fafb', emoji: '📅' },
};

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="events-page">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <h1>📅 Eventos</h1>
          <p class="header-sub">Conciertos y estrenos en Argentina</p>
        </div>
        <!-- Filter chips -->
        <div class="filter-chips">
          <button class="chip" [class.active]="activeFilter() === 'ALL'"
                  (click)="setFilter('ALL')">Todos</button>
          <button class="chip" [class.active]="activeFilter() === 'CONCERT'"
                  (click)="setFilter('CONCERT')">🎵 Conciertos</button>
          <button class="chip" [class.active]="activeFilter() === 'PREMIERE'"
                  (click)="setFilter('PREMIERE')">🎬 Estrenos</button>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-wrap">
          <div class="spinner"></div>
          <span>Cargando eventos...</span>
        </div>
      } @else {
        <!-- Month navigation -->
        <div class="cal-nav">
          <button class="nav-btn" (click)="prevMonth()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span class="cal-title">{{ monthName() }} {{ currentYear() }}</span>
          <button class="nav-btn" (click)="nextMonth()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        <!-- Calendar grid -->
        <div class="calendar">
          <!-- Day headers -->
          @for (d of dayNames; track d) {
            <div class="cal-day-header">{{ d }}</div>
          }

          <!-- Blank cells before first day of month -->
          @for (b of blanksBefore(); track $index) {
            <div class="cal-cell empty"></div>
          }

          <!-- Day cells -->
          @for (day of daysInMonth(); track day) {
            <div class="cal-cell"
                 [class.today]="isToday(day)"
                 [class.has-events]="getEventsForDay(day).length > 0"
                 (click)="selectDay(day)">
              <span class="day-num">{{ day }}</span>
              <div class="dot-row">
                @for (ev of getEventsForDay(day).slice(0, 3); track ev.id) {
                  <span class="dot" [style.background]="catColor(ev.category)"></span>
                }
              </div>
            </div>
          }
        </div>

        <!-- Events list for this month -->
        <div class="events-list-section">
          <h2 class="section-title">
            Eventos en {{ monthName() }}
            @if (monthEvents().length > 0) {
              <span class="count-badge">{{ monthEvents().length }}</span>
            }
          </h2>

          @if (monthEvents().length === 0) {
            <div class="empty-month">
              <span class="empty-icon">🗓️</span>
              <p>No hay eventos este mes.</p>
              <button class="chip active" (click)="nextMonth()">Ver mes siguiente →</button>
            </div>
          } @else {
            <div class="events-grid">
              @for (ev of monthEvents(); track ev.id) {
                <div class="event-card" [class.is-premiere]="ev.type === 'PREMIERE'"
                     (click)="openModal(ev)">
                  <div class="event-card-top" [style.background]="catBg(ev.category)">
                    <span class="cat-emoji">{{ catEmoji(ev.category) }}</span>
                    <span class="cat-badge" [style.background]="catColor(ev.category)">
                      {{ catLabel(ev.category) }}
                    </span>
                  </div>
                  <div class="event-card-body">
                    <div class="event-date-line">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      {{ formatDate(ev.eventDate) }}
                      @if (ev.eventTime) { · {{ formatTime(ev.eventTime) }} }
                    </div>
                    <h3 class="event-title">{{ ev.title }}</h3>
                    @if (ev.subtitle) {
                      <p class="event-subtitle">{{ ev.subtitle }}</p>
                    }
                    @if (ev.venue) {
                      <div class="event-venue">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        {{ ev.venue }}
                      </div>
                    }
                  </div>
                  @if (ev.ticketUrl) {
                    <a [href]="ev.ticketUrl" target="_blank" class="ticket-btn"
                       (click)="$event.stopPropagation()">
                      🎟️ Entradas
                    </a>
                  }
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Event detail modal -->
      @if (selectedEvent()) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <button class="modal-close" (click)="closeModal()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div class="modal-header" [style.background]="catBg(selectedEvent()!.category)">
              <span class="modal-emoji">{{ catEmoji(selectedEvent()!.category) }}</span>
              <span class="cat-badge lg" [style.background]="catColor(selectedEvent()!.category)">
                {{ catLabel(selectedEvent()!.category) }}
              </span>
            </div>
            <div class="modal-body">
              <h2>{{ selectedEvent()!.title }}</h2>
              @if (selectedEvent()!.subtitle) {
                <p class="modal-subtitle">{{ selectedEvent()!.subtitle }}</p>
              }
              <div class="modal-meta">
                <div class="meta-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <strong>{{ formatDate(selectedEvent()!.eventDate) }}</strong>
                  @if (selectedEvent()!.eventTime) { · {{ formatTime(selectedEvent()!.eventTime!) }} hs }
                </div>
                @if (selectedEvent()!.venue) {
                  <div class="meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    {{ selectedEvent()!.venue }}{{ selectedEvent()!.city ? ', ' + selectedEvent()!.city : '' }}
                  </div>
                }
              </div>
              @if (selectedEvent()!.description) {
                <p class="modal-desc">{{ selectedEvent()!.description }}</p>
              }
              @if (selectedEvent()!.ticketUrl) {
                <a [href]="selectedEvent()!.ticketUrl" target="_blank" class="modal-ticket-btn">
                  🎟️ Comprar entradas
                </a>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .events-page { min-height: 100vh; background: var(--bg-secondary); }

    /* Header */
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      flex-wrap: wrap; gap: 1rem;
      padding: 2rem 2rem 1rem; background: var(--bg-card);
      border-bottom: 1px solid var(--border);
    }
    .header-left h1 { margin: 0; font-size: 1.8rem; font-weight: 800; color: var(--text); }
    .header-sub { margin: 0.25rem 0 0; color: var(--text-secondary); font-size: 0.9rem; }

    /* Filter chips */
    .filter-chips { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; padding-top: 0.25rem; }
    .chip {
      padding: 6px 14px; border-radius: 20px; border: 1.5px solid var(--border);
      background: var(--bg-card); font-size: 0.82rem; cursor: pointer; font-weight: 500;
      color: var(--text-secondary); transition: all 0.15s;
    }
    .chip:hover { border-color: var(--info); color: var(--info); }
    .chip.active { background: var(--info); border-color: var(--info); color: white; }

    /* Loading */
    .loading-wrap { display: flex; align-items: center; justify-content: center; gap: 0.75rem;
      padding: 4rem; color: var(--text-secondary); font-size: 0.9rem; }
    .spinner { width: 24px; height: 24px; border: 3px solid var(--border);
      border-top-color: var(--info); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Month navigation */
    .cal-nav {
      display: flex; align-items: center; justify-content: center; gap: 1.5rem;
      padding: 1.25rem 2rem;
    }
    .cal-title { font-size: 1.2rem; font-weight: 700; color: var(--text); min-width: 200px; text-align: center; }
    .nav-btn {
      width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid var(--border);
      background: var(--bg-card); cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: var(--text); transition: all 0.15s;
    }
    .nav-btn:hover { background: var(--bg-secondary); border-color: var(--text-secondary); }

    /* Calendar */
    .calendar {
      display: grid; grid-template-columns: repeat(7, 1fr);
      gap: 0; margin: 0 2rem 2rem;
      border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
      background: var(--bg-card); box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .cal-day-header {
      padding: 0.6rem; text-align: center; font-size: 0.75rem; font-weight: 600;
      color: var(--text-secondary); text-transform: uppercase; background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
    }
    .cal-cell {
      min-height: 80px; padding: 0.4rem; border-right: 1px solid var(--border);
      border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.12s;
      position: relative;
    }
    .cal-cell:hover { background: var(--bg-secondary); }
    .cal-cell.has-events { background: var(--bg-card); }
    .cal-cell.has-events:hover { background: var(--info-bg); }
    .cal-cell.today .day-num {
      background: var(--info); color: white; border-radius: 50%;
      width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
      font-weight: 700;
    }
    .cal-cell.empty { background: var(--bg-secondary); cursor: default; }
    .day-num { font-size: 0.82rem; color: var(--text); font-weight: 500;
      display: inline-block; width: 24px; height: 24px; line-height: 24px; text-align: center; }
    .dot-row { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; }
    .dot { width: 7px; height: 7px; border-radius: 50%; }

    /* Events list */
    .events-list-section { padding: 0 2rem 3rem; }
    .section-title {
      font-size: 1.1rem; font-weight: 700; color: var(--text);
      margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.6rem;
    }
    .count-badge {
      background: var(--info); color: white; font-size: 0.72rem;
      padding: 2px 8px; border-radius: 12px; font-weight: 700;
    }

    .empty-month {
      display: flex; flex-direction: column; align-items: center;
      gap: 0.75rem; padding: 3rem; text-align: center;
    }
    .empty-icon { font-size: 3rem; }
    .empty-month p { color: var(--text-secondary); margin: 0; }

    /* Events grid */
    .events-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }
    .event-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
      overflow: hidden; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
      display: flex; flex-direction: column;
    }
    .event-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }

    .event-card-top {
      padding: 1.5rem 1.25rem 1rem; display: flex;
      align-items: center; justify-content: space-between;
    }
    .cat-emoji { font-size: 2.2rem; line-height: 1; }
    .cat-badge {
      color: white; font-size: 0.7rem; font-weight: 700; padding: 3px 10px;
      border-radius: 12px; letter-spacing: 0.04em;
    }
    .cat-badge.lg { font-size: 0.8rem; padding: 5px 14px; }

    .event-card-body { padding: 0.75rem 1.25rem 1rem; flex: 1; }
    .event-date-line {
      display: flex; align-items: center; gap: 0.4rem;
      font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.4rem;
    }
    .event-title { margin: 0 0 0.3rem; font-size: 0.95rem; font-weight: 700; color: var(--text);
      line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden; }
    .event-subtitle { margin: 0 0 0.4rem; font-size: 0.78rem; color: var(--text-secondary);
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .event-venue {
      display: flex; align-items: center; gap: 0.3rem;
      font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.4rem;
    }

    .ticket-btn {
      display: block; margin: 0 1.25rem 1.25rem; padding: 8px 0; text-align: center;
      background: var(--text); color: var(--bg-card); border-radius: 8px; text-decoration: none;
      font-size: 0.8rem; font-weight: 600; transition: background 0.15s;
    }
    .ticket-btn:hover { background: var(--text-secondary); }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
    .modal {
      background: var(--bg-card); border-radius: 16px; max-width: 500px; width: 100%;
      max-height: 90vh; overflow-y: auto; position: relative;
      animation: slideUp 0.2s ease;
    }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; } }
    .modal-close {
      position: absolute; top: 1rem; right: 1rem; z-index: 10;
      width: 32px; height: 32px; border-radius: 50%; border: none;
      background: rgba(255,255,255,0.8); cursor: pointer; display: flex;
      align-items: center; justify-content: center;
      /* Fixed near-white background regardless of theme, so the icon must
         stay dark too — var(--text) turns light in dark mode and disappears. */
      color: #1f2937;
    }
    .modal-header {
      padding: 2rem 1.5rem 1.5rem; display: flex; align-items: center; gap: 1rem;
    }
    .modal-emoji { font-size: 3rem; line-height: 1; }
    .modal-body { padding: 0 1.5rem 1.5rem; }
    .modal-body h2 { margin: 0 0 0.4rem; font-size: 1.3rem; font-weight: 800; color: var(--text); }
    .modal-subtitle { margin: 0 0 1rem; color: var(--text-secondary); font-size: 0.88rem; }
    .modal-meta { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
    .meta-item { display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.85rem; color: var(--text); }
    .modal-desc { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 1.25rem; }
    .modal-ticket-btn {
      display: block; padding: 12px; text-align: center;
      background: var(--info); color: white; border-radius: 10px; text-decoration: none;
      font-size: 0.9rem; font-weight: 700;
    }
    .modal-ticket-btn:hover { background: var(--info-text); }

    @media (max-width: 600px) {
      .page-header { flex-direction: column; }
      .calendar { margin: 0 0.75rem 1.5rem; }
      .events-list-section { padding: 0 0.75rem 2rem; }
      .cal-nav { padding: 1rem; }
      .cal-cell { min-height: 56px; }
    }
  `],
})
export class EventsComponent implements OnInit {
  private http = inject(HttpClient);

  allEvents = signal<CalendarEvent[]>([]);
  loading = signal(true);
  activeFilter = signal<'ALL' | 'CONCERT' | 'PREMIERE'>('ALL');
  selectedEvent = signal<CalendarEvent | null>(null);

  private currentDate = signal(new Date());

  readonly currentYear  = computed(() => this.currentDate().getFullYear());
  readonly currentMonth = computed(() => this.currentDate().getMonth()); // 0-indexed
  readonly monthName    = computed(() => MONTH_NAMES[this.currentMonth()]);
  readonly dayNames = DAY_NAMES;

  /** Days 1..N in current month */
  readonly daysInMonth = computed(() => {
    const n = new Date(this.currentYear(), this.currentMonth() + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => i + 1);
  });

  /** Blank cells before day 1 (week starts Monday) */
  readonly blanksBefore = computed(() => {
    const firstDay = new Date(this.currentYear(), this.currentMonth(), 1).getDay();
    // JS: 0=Sun, convert to Mon-start
    return Array.from({ length: (firstDay + 6) % 7 });
  });

  /** Events in the current month filtered by active filter */
  readonly monthEvents = computed(() => {
    const y = this.currentYear();
    const m = this.currentMonth() + 1; // 1-indexed
    const mm = String(m).padStart(2, '0');
    return this.allEvents()
      .filter(e => {
        const matches = e.eventDate.startsWith(`${y}-${mm}`);
        if (!matches) return false;
        if (this.activeFilter() === 'ALL') return true;
        return e.type === this.activeFilter();
      })
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  });

  ngOnInit(): void {
    // Start from today's month
    this.http.get<CalendarEvent[]>(`${environment.apiUrl}/events`).subscribe({
      next: (data) => { this.allEvents.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  setFilter(f: 'ALL' | 'CONCERT' | 'PREMIERE'): void {
    this.activeFilter.set(f);
  }

  prevMonth(): void {
    const d = new Date(this.currentDate());
    d.setMonth(d.getMonth() - 1);
    this.currentDate.set(d);
  }

  nextMonth(): void {
    const d = new Date(this.currentDate());
    d.setMonth(d.getMonth() + 1);
    this.currentDate.set(d);
  }

  isToday(day: number): boolean {
    const now = new Date();
    return now.getFullYear() === this.currentYear()
        && now.getMonth() === this.currentMonth()
        && now.getDate() === day;
  }

  getEventsForDay(day: number): CalendarEvent[] {
    const y = this.currentYear();
    const m = String(this.currentMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const key = `${y}-${m}-${d}`;
    return this.allEvents().filter(e => {
      if (e.eventDate !== key) return false;
      if (this.activeFilter() === 'ALL') return true;
      return e.type === this.activeFilter();
    });
  }

  selectDay(day: number): void {
    const evs = this.getEventsForDay(day);
    if (evs.length === 1) this.openModal(evs[0]);
  }

  openModal(ev: CalendarEvent): void {
    this.selectedEvent.set(ev);
    document.body.style.overflow = 'hidden';
  }

  closeModal(): void {
    this.selectedEvent.set(null);
    document.body.style.overflow = '';
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  catColor(cat: string): string  { return (CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG['OTHER']).color; }
  catBg(cat: string): string     { return (CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG['OTHER']).bg; }
  catEmoji(cat: string): string  { return (CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG['OTHER']).emoji; }
  catLabel(cat: string): string  { return (CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG['OTHER']).label; }

  formatDate(date: string): string {
    const d = new Date(date + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'long' });
  }

  formatTime(time: string): string {
    // time is "HH:MM:SS"
    const [h, m] = time.split(':');
    return `${h}:${m}`;
  }
}
