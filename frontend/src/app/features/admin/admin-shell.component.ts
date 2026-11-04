import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="admin-layout">
      <nav class="sidebar">
        <div class="sidebar-header">
          <span>⚙ Admin</span>
        </div>
        <ul>
          <li><a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">📊 Dashboard</a></li>

          <li class="nav-section">TIENDA</li>
          <li><a routerLink="/admin/categories" routerLinkActive="active">🗂 Categorías</a></li>
          <li><a routerLink="/admin/products" routerLinkActive="active">📦 Productos</a></li>
          <li><a routerLink="/admin/orders" routerLinkActive="active">🛒 Pedidos</a></li>
          <li><a routerLink="/admin/shipping" routerLinkActive="active">🚚 Envíos</a></li>
          <li><a routerLink="/admin/gift-cards" routerLinkActive="active">🎁 Gift Cards</a></li>

          <li class="nav-section">ATENCIÓN</li>
          <li><a routerLink="/admin/questions" routerLinkActive="active">❓ Preguntas</a></li>
          <li><a routerLink="/admin/suggestions" routerLinkActive="active">💡 Sugerencias</a></li>
          <li><a routerLink="/admin/size-guides" routerLinkActive="active">📏 Talles</a></li>

          <li class="nav-section">EVENTOS</li>
          <li><a routerLink="/admin/events" routerLinkActive="active">📅 Calendario</a></li>
          <li><a routerLink="/admin/promotions" routerLinkActive="active">🏷 Promociones</a></li>
          <li><a routerLink="/admin/returns" routerLinkActive="active">↩ Devoluciones</a></li>

          <li class="nav-section">COMUNICACIÓN</li>
          <li><a routerLink="/admin/newsletter" routerLinkActive="active">📨 Newsletter</a></li>
          <li><a routerLink="/admin/blog" routerLinkActive="active">✍ Blog</a></li>
          <li><a routerLink="/admin/reviews" routerLinkActive="active">💬 Reseñas</a></li>

          <li class="nav-section">SISTEMA</li>
          <li><a routerLink="/admin/users" routerLinkActive="active">👥 Usuarios</a></li>
          <li><a routerLink="/admin/bulk-upload" routerLinkActive="active">⬆ Subida masiva</a></li>
        </ul>
        <div class="sidebar-footer">
          <a routerLink="/">← Volver a la tienda</a>
        </div>
      </nav>
      <main class="admin-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .admin-layout { display: flex; min-height: 100vh; }

    /* Sidebar */
    .sidebar {
      width: 228px; min-height: 100vh; background: #111827; color: white;
      display: flex; flex-direction: column; flex-shrink: 0;
    }
    .sidebar-header {
      padding: 1.25rem 1.5rem; font-weight: 700; font-size: 1.1rem;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .sidebar ul { list-style: none; padding: 0.5rem 0; margin: 0; flex: 1; }
    .sidebar li a {
      display: block; padding: 0.65rem 1.5rem; color: rgba(255,255,255,0.75);
      text-decoration: none; font-size: 0.875rem; transition: background 0.15s, color 0.15s;
    }
    .sidebar li a:hover { background: rgba(255,255,255,0.07); color: white; }
    .sidebar li a.active { background: rgba(255,255,255,0.12); color: white; font-weight: 600; }
    .nav-section {
      padding: 0.75rem 1.5rem 0.25rem;
      font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em;
      color: rgba(255,255,255,0.3); text-transform: uppercase;
    }
    .sidebar-footer {
      padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,0.1);
    }
    .sidebar-footer a { color: rgba(255,255,255,0.5); font-size: 0.82rem; text-decoration: none; }
    .sidebar-footer a:hover { color: white; }

    /* Content */
    .admin-content {
      flex: 1;
      background: var(--bg);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      min-width: 0;
      transition: background 0.2s;
    }
  `],
})
export class AdminShellComponent {}
