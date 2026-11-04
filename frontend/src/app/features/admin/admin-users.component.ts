import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { ToastService } from '../../core/services/toast.service';

interface UserItem {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  enabled: boolean;
  createdAt: string;
}

interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}

const ROLES = ['CUSTOMER', 'WORKER', 'ADMIN'];

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>Usuarios <span class="count">{{ total() }}</span></h2>
      </div>

      @if (loading()) {
        <div class="skeleton-rows">
          @for (_ of [1,2,3,4,5]; track $index) {
            <div class="skeleton sk-row"></div>
          }
        </div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Registrado</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (u of users(); track u.id) {
                <tr [class.disabled-row]="!u.enabled">
                  <td class="user-cell">
                    <div class="avatar-sm">{{ initials(u) }}</div>
                    <span>{{ u.firstName }} {{ u.lastName }}</span>
                  </td>
                  <td class="email">{{ u.email }}</td>
                  <td>
                    <select class="role-select"
                            [value]="u.role"
                            (change)="changeRole(u, $any($event.target).value)"
                            [disabled]="updating() === u.id">
                      @for (r of roles; track r) {
                        <option [value]="r" [selected]="u.role === r">{{ roleLabel(r) }}</option>
                      }
                    </select>
                  </td>
                  <td class="date">{{ formatDate(u.createdAt) }}</td>
                  <td>
                    <span class="badge" [class.badge-active]="u.enabled" [class.badge-inactive]="!u.enabled">
                      {{ u.enabled ? 'Activo' : 'Desactivado' }}
                    </span>
                  </td>
                  <td class="actions">
                    <button class="btn-icon" [title]="u.enabled ? 'Desactivar cuenta' : 'Activar cuenta'"
                            (click)="toggleEnabled(u)"
                            [disabled]="updating() === u.id">
                      {{ u.enabled ? '🚫' : '✅' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div class="pagination">
            <button [disabled]="currentPage() === 0" (click)="goTo(currentPage() - 1)">← Anterior</button>
            <span>Página {{ currentPage() + 1 }} de {{ totalPages() }}</span>
            <button [disabled]="currentPage() >= totalPages() - 1" (click)="goTo(currentPage() + 1)">Siguiente →</button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .page { padding: 2rem; }
    .page-header { margin-bottom: 1.5rem; }
    .page-header h2 { font-size: 1.4rem; font-weight: 700; color: var(--text); margin: 0; }
    .count {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--border); color: var(--text); font-size: 0.8rem; font-weight: 600;
      border-radius: 99px; padding: 0.1rem 0.6rem; margin-left: 0.5rem;
    }

    /* Table */
    .table-wrap { background: var(--bg-card); border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.07); }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      background: var(--bg-secondary); padding: 0.75rem 1rem; text-align: left;
      font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);
      text-transform: uppercase; letter-spacing: 0.04em;
      border-bottom: 1px solid var(--border);
    }
    tbody tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
    tbody tr:hover { background: var(--bg-secondary); }
    tbody tr.disabled-row { opacity: 0.5; }
    tbody td { padding: 0.8rem 1rem; font-size: 0.875rem; color: var(--text); vertical-align: middle; }

    .user-cell { display: flex; align-items: center; gap: 0.65rem; font-weight: 600; }
    .avatar-sm {
      width: 34px; height: 34px; border-radius: 50%;
      background: linear-gradient(135deg, var(--primary-dark), var(--primary));
      color: white; font-size: 0.75rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .email { color: var(--text-secondary); font-size: 0.82rem; }
    .date { color: var(--text-secondary); font-size: 0.82rem; }

    .role-select {
      padding: 0.3rem 0.5rem; border: 1.5px solid var(--border); border-radius: 6px;
      font-size: 0.82rem; background: var(--bg-card); cursor: pointer;
    }
    .role-select:focus { border-color: var(--primary); outline: none; }

    .badge {
      display: inline-block; padding: 0.2rem 0.6rem; border-radius: 99px;
      font-size: 0.75rem; font-weight: 600;
    }
    .badge-active { background: var(--success-bg); color: var(--success-text); }
    .badge-inactive { background: var(--danger-bg); color: var(--danger-text); }

    .actions { display: flex; gap: 0.5rem; }
    .btn-icon {
      background: none; border: none; cursor: pointer;
      font-size: 1rem; padding: 0.25rem; border-radius: 4px;
    }
    .btn-icon:hover:not(:disabled) { background: var(--bg-secondary); }
    .btn-icon:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Pagination */
    .pagination {
      display: flex; align-items: center; justify-content: center; gap: 1rem;
      padding: 1.25rem; font-size: 0.875rem; color: var(--text-secondary);
    }
    .pagination button {
      background: var(--bg-card); border: 1.5px solid var(--border); border-radius: 8px;
      padding: 0.4rem 0.85rem; cursor: pointer; font-size: 0.82rem; font-weight: 500;
    }
    .pagination button:hover:not(:disabled) { background: var(--bg-secondary); }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Skeleton */
    .skeleton-rows { display: flex; flex-direction: column; gap: 0.5rem; }
    .skeleton { background: var(--border); border-radius: 8px; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .sk-row { height: 56px; }
  `]
})
export class AdminUsersComponent implements OnInit {
  private readonly apiUrl = `${environment.apiUrl}/admin/users`;

  roles = ROLES;
  users = signal<UserItem[]>([]);
  loading = signal(true);
  updating = signal<number | null>(null);
  total = signal(0);
  totalPages = signal(0);
  currentPage = signal(0);

  constructor(private http: HttpClient, private toast: ToastService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.http.get<PageResponse<UserItem>>(`${this.apiUrl}?page=${this.currentPage()}&size=20`).subscribe({
      next: (page) => {
        this.users.set(page.content);
        this.total.set(page.totalElements);
        this.totalPages.set(page.totalPages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  goTo(page: number): void {
    this.currentPage.set(page);
    this.load();
  }

  changeRole(user: UserItem, role: string): void {
    this.updating.set(user.id);
    this.http.patch<UserItem>(`${this.apiUrl}/${user.id}/role`, { role }).subscribe({
      next: (updated) => {
        this.users.update(list => list.map(u => u.id === updated.id ? updated : u));
        this.updating.set(null);
        this.toast.success(`Rol de ${user.firstName} cambiado a ${this.roleLabel(role)}`);
      },
      error: () => {
        this.updating.set(null);
        this.toast.error('Error al cambiar el rol');
      },
    });
  }

  toggleEnabled(user: UserItem): void {
    this.updating.set(user.id);
    this.http.patch<void>(`${this.apiUrl}/${user.id}/enabled`, { enabled: !user.enabled }).subscribe({
      next: () => {
        this.users.update(list => list.map(u => u.id === user.id ? { ...u, enabled: !u.enabled } : u));
        this.updating.set(null);
        this.toast.success(!user.enabled ? 'Cuenta activada' : 'Cuenta desactivada');
      },
      error: () => {
        this.updating.set(null);
        this.toast.error('Error al actualizar el usuario');
      },
    });
  }

  initials(u: UserItem): string {
    return `${u.firstName[0] || ''}${u.lastName[0] || ''}`.toUpperCase();
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = { ADMIN: 'Admin', WORKER: 'Empleado', CUSTOMER: 'Cliente' };
    return map[role] || role;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
