package com.tiendaropa.repository;

import com.tiendaropa.entity.ShippingRate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ShippingRateRepository extends JpaRepository<ShippingRate, Long> {

    List<ShippingRate> findByProvinceIgnoreCaseAndActiveTrue(String province);

    List<ShippingRate> findByActiveTrue();
}
