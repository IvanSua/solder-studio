import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-worker-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="worker-layout">
      <nav class="sidebar">
        <div class="sidebar-header">
          <span>🔧 Panel Worker</span>
        </div>
        <ul>
          <li><a routerLink="/worker/orders" routerLinkActive="active">🛒 Pedidos</a></li>
        </ul>
        <div class="sidebar-footer">
          <a routerLink="/">← Volver a la tienda</a>
        </div>
      </nav>
      <main class="worker-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .worker-layout { display: flex; min-height: 100vh; }

    .sidebar {
      width: 220px; min-height: 100vh; background: #1e3a5f; color: white;
      display: flex; flex-direction: column; flex-shrink: 0;
    }
    .sidebar-header {
      padding: 1.25rem 1.5rem; font-weight: 700; font-size: 1.05rem;
      border-bottom: 1px solid rgba(255,255,255,0.12);
    }
    .sidebar ul { list-style: none; padding: 0.5rem 0; margin: 0; flex: 1; }
    .sidebar li a {
      display: block; padding: 0.65rem 1.5rem; color: rgba(255,255,255,0.75);
      text-decoration: none; font-size: 0.875rem; transition: background 0.15s, color 0.15s;
    }
    .sidebar li a:hover { background: rgba(255,255,255,0.08); color: white; }
    .sidebar li a.active { background: rgba(255,255,255,0.14); color: white; font-weight: 600; }
    .sidebar-footer {
      padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,0.12);
    }
    .sidebar-footer a { color: rgba(255,255,255,0.5); font-size: 0.82rem; text-decoration: none; }
    .sidebar-footer a:hover { color: white; }

    .worker-content { flex: 1; background: var(--bg-secondary); overflow-y: auto; }
  `],
})
export class WorkerShellComponent {}
