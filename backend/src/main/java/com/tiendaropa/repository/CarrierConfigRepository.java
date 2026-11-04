package com.tiendaropa.repository;

import com.tiendaropa.entity.CarrierConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CarrierConfigRepository extends JpaRepository<CarrierConfig, Long> {

    Optional<CarrierConfig> findByCarrierCode(String carrierCode);

    List<CarrierConfig> findByEnabledTrue();
}
