import { Component, inject, computed, effect } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { ToastContainerComponent } from './shared/components/toast/toast.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { ChatWidgetComponent } from './shared/components/chat-widget/chat-widget.component';
import { AuthService } from './core/services/auth.service';
import { CartService } from './core/services/cart.service';
import { WishlistService } from './core/services/wishlist.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavbarComponent, ToastContainerComponent, FooterComponent, ChatWidgetComponent],
  template: `
    <div class="app-shell">
      @if (showNavbar()) {
        <app-navbar />
      }
      <main class="app-main">
        <router-outlet />
      </main>
      @if (showNavbar()) {
        <app-footer />
      }
    </div>
    <app-toast-container />
    <app-chat-widget />
  `,
  styles: [`
    .app-shell {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .app-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
    }
  `],
})
export class AppComponent {
  private router = inject(Router);
  private auth = inject(AuthService);
  private cartService = inject(CartService);
  private wishlistService = inject(WishlistService);

  // Reactive URL signal — re-evaluates on every NavigationEnd event.
  // startWith('') ensures the signal has a value before the first navigation.
  private currentUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  // Hide navbar on /admin, /worker and /auth routes
  showNavbar = computed(() => {
    const url = this.currentUrl();
    return !url.startsWith('/admin') && !url.startsWith('/worker') && !url.startsWith('/auth');
  });

  constructor() {
    // Reactively reload cart & wishlist whenever the user authenticates.
    // This covers three cases:
    //  1. Page load while already logged in (initial effect run)
    //  2. Login / register during the session (signal transitions false → true)
    //  3. OAuth2 callback that stores the token asynchronously
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.cartService.loadCart().subscribe({ error: () => {} });
        this.wishlistService.loadWishlistIds();

        // If the user was redirected to login while trying to add an item,
        // add it now automatically and clear the pending intent.
        const pending = this.cartService.getPendingItem();
        if (pending) {
          this.cartService.clearPendingItem();
          this.cartService.addItem(pending).subscribe({ error: () => {} });
        }
      }
    });
  }

}
