package com.tiendaropa.service;

import com.tiendaropa.dto.request.SizeGuideRequest;
import com.tiendaropa.dto.response.SizeGuideResponse;
import com.tiendaropa.entity.Category;
import com.tiendaropa.entity.SizeGuide;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.CategoryRepository;
import com.tiendaropa.repository.SizeGuideRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SizeGuideService {

    private final SizeGuideRepository sizeGuideRepository;
    private final CategoryRepository categoryRepository;

    @Transactional(readOnly = true)
    public List<SizeGuideResponse> getByCategory(Long categoryId) {
        return sizeGuideRepository.findActiveByCategory(categoryId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SizeGuideResponse> getAllActive() {
        return sizeGuideRepository.findByActiveTrueOrderByCategoryName().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SizeGuideResponse getById(Long id) {
        SizeGuide guide = sizeGuideRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Guía de talles no encontrada: " + id));
        return mapToResponse(guide);
    }

    @Transactional
    public SizeGuideResponse create(SizeGuideRequest request) {
        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada: " + request.getCategoryId()));

        SizeGuide guide = SizeGuide.builder()
                .category(category)
                .name(request.getName())
                .sizes(request.getSizes())
                .measurements(request.getMeasurements())
                .instructions(request.getInstructions())
                .active(request.getActive() != null ? request.getActive() : true)
                .build();

        return mapToResponse(sizeGuideRepository.save(guide));
    }

    @Transactional
    public SizeGuideResponse update(Long id, SizeGuideRequest request) {
        SizeGuide guide = sizeGuideRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Guía de talles no encontrada: " + id));

        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada: " + request.getCategoryId()));
            guide.setCategory(category);
        }

        if (request.getName() != null) guide.setName(request.getName());
        if (request.getSizes() != null) guide.setSizes(request.getSizes());
        if (request.getMeasurements() != null) guide.setMeasurements(request.getMeasurements());
        if (request.getInstructions() != null) guide.setInstructions(request.getInstructions());
        if (request.getActive() != null) guide.setActive(request.getActive());

        return mapToResponse(sizeGuideRepository.save(guide));
    }

    @Transactional
    public void delete(Long id) {
        SizeGuide guide = sizeGuideRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Guía de talles no encontrada: " + id));
        guide.setActive(false);
        sizeGuideRepository.save(guide);
    }

    private SizeGuideResponse mapToResponse(SizeGuide guide) {
        return SizeGuideResponse.builder()
                .id(guide.getId())
                .categoryId(guide.getCategory().getId())
                .categoryName(guide.getCategory().getName())
                .name(guide.getName())
                .sizes(guide.getSizes())
                .measurements(guide.getMeasurements())
                .instructions(guide.getInstructions())
                .active(guide.isActive())
                .createdAt(guide.getCreatedAt())
                .updatedAt(guide.getUpdatedAt())
                .build();
    }
}
