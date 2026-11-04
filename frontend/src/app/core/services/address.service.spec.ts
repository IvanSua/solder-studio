/**
 * AddressService - Unit Tests
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AddressService } from './address.service';
import { Address, AddressRequest } from '../models/address.model';
import { environment } from '@env/environment';

describe('AddressService', () => {
  let service: AddressService;
  let httpMock: HttpTestingController;

  const mockAddress: Address = {
    id: 1,
    street: 'Calle Falsa',
    apartment: '123',
    city: 'Buenos Aires',
    province: 'Buenos Aires',
    postalCode: '1234',
    notes: null,
    defaultAddress: true,
  };

  const mockRequest: AddressRequest = {
    street: 'Calle Falsa',
    apartment: '123',
    city: 'Buenos Aires',
    province: 'Buenos Aires',
    postalCode: '1234',
    defaultAddress: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AddressService],
    });
    service = TestBed.inject(AddressService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getAddresses()', () => {
    it('debería hacer GET a /addresses', () => {
      service.getAddresses().subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/addresses`);
      expect(req.request.method).toBe('GET');
    });

    it('debería retornar array de direcciones', () => {
      service.getAddresses().subscribe(addresses => {
        expect(addresses.length).toBe(1);
        expect(addresses[0].street).toBe('Calle Falsa');
      });
      const req = httpMock.expectOne(`${environment.apiUrl}/addresses`);
      req.flush([mockAddress]);
    });
  });

  describe('createAddress()', () => {
    it('debería hacer POST a /addresses', () => {
      service.createAddress(mockRequest).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/addresses`);
      expect(req.request.method).toBe('POST');
    });

    it('debería retornar la dirección creada', () => {
      service.createAddress(mockRequest).subscribe(address => {
        expect(address.id).toBe(1);
      });
      const req = httpMock.expectOne(`${environment.apiUrl}/addresses`);
      req.flush(mockAddress);
    });
  });

  describe('updateAddress()', () => {
    it('debería hacer PUT a /addresses/{id}', () => {
      service.updateAddress(1, mockRequest).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/addresses/1`);
      expect(req.request.method).toBe('PUT');
    });
  });

  describe('deleteAddress()', () => {
    it('debería hacer DELETE a /addresses/{id}', () => {
      service.deleteAddress(1).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/addresses/1`);
      expect(req.request.method).toBe('DELETE');
    });
  });

  describe('setDefault()', () => {
    it('debería hacer PATCH a /addresses/{id}/default', () => {
      service.setDefault(1).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/addresses/1/default`);
      expect(req.request.method).toBe('PATCH');
    });
  });
});
