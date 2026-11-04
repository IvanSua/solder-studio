/**
 * ToastService - Unit Tests
 * 
 * Tests para el servicio de notificaciones toast.
 * No usa HTTP, solo signals y setTimeout.
 */

import { ToastService, ToastType } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    // ToastService no tiene dependencias, se puede crear directamente
    service = new ToastService();
  });

  afterEach(() => {
    // Limpiar timeouts pendientes
    service.dismiss(999); // dismiss no hace nada si no existe
  });

  // ==========================================================================
  // TESTS DE ESTADO INICIAL
  // ==========================================================================

  describe('Estado Inicial', () => {
    it('debería empezar sin toasts', () => {
      expect(service.toasts().length).toBe(0);
    });

    it('debería retornar un array vacío', () => {
      expect(service.toasts()).toEqual([]);
    });
  });

  // ==========================================================================
  // TESTS DE show()
  // ==========================================================================

  describe('show()', () => {
    it('debería agregar un toast a la lista', () => {
      service.show('Mensaje de prueba');

      expect(service.toasts().length).toBe(1);
    });

    it('debería crear toast con valores por defecto', () => {
      service.show('Mensaje');

      const toast = service.toasts()[0];
      expect(toast.message).toBe('Mensaje');
      expect(toast.type).toBe('info');
      expect(toast.duration).toBe(3500);
    });

    it('debería crear toast con tipo personalizado', () => {
      service.show('Error', 'error');

      const toast = service.toasts()[0];
      expect(toast.type).toBe('error');
    });

    it('debería crear toast con duración personalizada', () => {
      service.show('Warning', 'warning', 10000);

      const toast = service.toasts()[0];
      expect(toast.duration).toBe(10000);
    });

    it('debería asignar IDs únicos y crecientes', () => {
      service.show('Primero');
      service.show('Segundo');
      service.show('Tercero');

      const toasts = service.toasts();
      expect(toasts[0].id).toBeLessThan(toasts[1].id);
      expect(toasts[1].id).toBeLessThan(toasts[2].id);
    });
  });

  // ==========================================================================
  // TESTS DE success()
  // ==========================================================================

  describe('success()', () => {
    it('debería mostrar toast de tipo success', () => {
      service.success('Operación exitosa');

      expect(service.toasts()[0].type).toBe('success');
      expect(service.toasts()[0].message).toBe('Operación exitosa');
    });

    it('debería usar duración por defecto de 3500ms', () => {
      service.success('Test');

      expect(service.toasts()[0].duration).toBe(3500);
    });

    it('debería permitir duración personalizada', () => {
      service.success('Test', 5000);

      expect(service.toasts()[0].duration).toBe(5000);
    });
  });

  // ==========================================================================
  // TESTS DE error()
  // ==========================================================================

  describe('error()', () => {
    it('debería mostrar toast de tipo error', () => {
      service.error('Algo salió mal');

      expect(service.toasts()[0].type).toBe('error');
      expect(service.toasts()[0].message).toBe('Algo salió mal');
    });

    it('debería usar duración mayor para errores (5000ms)', () => {
      service.error('Error');

      expect(service.toasts()[0].duration).toBe(5000);
    });
  });

  // ==========================================================================
  // TESTS DE warning()
  // ==========================================================================

  describe('warning()', () => {
    it('debería mostrar toast de tipo warning', () => {
      service.warning('Cuidado');

      expect(service.toasts()[0].type).toBe('warning');
    });
  });

  // ==========================================================================
  // TESTS DE info()
  // ==========================================================================

  describe('info()', () => {
    it('debería mostrar toast de tipo info', () => {
      service.info('Información');

      expect(service.toasts()[0].type).toBe('info');
    });
  });

  // ==========================================================================
  // TESTS DE dismiss()
  // ==========================================================================

  describe('dismiss()', () => {
    it('debería eliminar un toast por ID', () => {
      service.show('Uno');
      service.show('Dos');

      service.dismiss(1);

      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].message).toBe('Dos');
    });

    it('debería no tirar error si el ID no existe', () => {
      service.show('Test');

      expect(() => service.dismiss(999)).not.toThrow();
    });

    it('debería manejar dismiss de todos los toasts', () => {
      service.show('Uno');
      service.show('Dos');
      service.show('Tres');

      service.dismiss(1);
      service.dismiss(2);
      service.dismiss(3);

      expect(service.toasts().length).toBe(0);
    });
  });

  // ==========================================================================
  // TESTS DE INTEGRACIÓN
  // ==========================================================================

  describe('Flujo completo', () => {
    it('debería permitir agregar y eliminar múltiples toasts', () => {
      service.success('Guardado');
      service.error('Error');
      service.warning('Advertencia');

      expect(service.toasts().length).toBe(3);

      // Eliminar el del medio
      const middleId = service.toasts()[1].id;
      service.dismiss(middleId);

      expect(service.toasts().length).toBe(2);
      expect(service.toasts()[0].type).toBe('success');
      expect(service.toasts()[1].type).toBe('warning');
    });
  });

  // ==========================================================================
  // TESTS DE TIPOS
  // ==========================================================================

  describe('Tipos de Toast', () => {
    it('debería aceptar todos los tipos válidos', () => {
      const types: ToastType[] = ['success', 'error', 'warning', 'info'];

      types.forEach(type => {
        service.show(`Test ${type}`, type);
        expect(service.toasts()[service.toasts().length - 1].type).toBe(type);
      });
    });
  });
});
