package com.tiendaropa.config;

import io.github.bucket4j.distributed.proxy.ProxyManager;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.lettuce.core.RedisClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

import java.time.Duration;
import java.util.Map;

@Configuration
@Slf4j
public class RedisConfig implements CachingConfigurer {

    private static final String[] CACHE_NAMES =
            {"products", "productLists", "categories", "promotions", "banners"};

    /**
     * When {@code true} (set in application-prod.yml), Redis connectivity errors
     * cause the application to fail fast instead of falling back to in-memory cache.
     * This prevents silent data inconsistency in multi-instance production deployments.
     */
    @Value("${app.redis.fail-fast:false}")
    private boolean failFast;

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory connectionFactory,
                                     ObjectMapper springObjectMapper) {
        // Probe Redis eagerly.
        try {
            connectionFactory.getConnection().ping();
        } catch (Exception ex) {
            if (failFast) {
                throw new IllegalStateException(
                        "Redis is required in this environment but is not reachable: " + ex.getMessage(), ex);
            }
            log.warn("Redis is not reachable ({}). Falling back to in-memory cache. " +
                     "Start Redis to enable distributed caching.", ex.getMessage());
            return new ConcurrentMapCacheManager(CACHE_NAMES);
        }

        // Use a COPY of Spring Boot's auto-configured ObjectMapper so we inherit
        // ParameterNamesModule (needed to deserialize Java records) while adding
        // default-typing for Redis polymorphic deserialization.
        // Versioned prefix: bump "v4::" → "v5::" on next incompatible DTO change.
        // Bumped to v5 because ProductService now caches CachedPage<ProductResponse>
        // under "productLists" instead of the old raw Page<ProductResponse> — reading
        // a leftover v4 entry (serialized without the CachedPage wrapper, some without
        // @class typing at all) with the current deserializer threw
        // "missing type id property '@class'" on every request.
        ObjectMapper redisMapper = springObjectMapper.copy()
                .activateDefaultTyping(
                        springObjectMapper.getPolymorphicTypeValidator(),
                        ObjectMapper.DefaultTyping.NON_FINAL,
                        JsonTypeInfo.As.PROPERTY);

        GenericJackson2JsonRedisSerializer serializer =
                new GenericJackson2JsonRedisSerializer(redisMapper);

        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .prefixCacheNameWith("tienda:v5::")
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(serializer))
                .disableCachingNullValues();

        Map<String, RedisCacheConfiguration> cacheConfigs = Map.of(
                "products",     defaultConfig.entryTtl(Duration.ofMinutes(15)),
                "productLists", defaultConfig.entryTtl(Duration.ofMinutes(5)),
                "categories",   defaultConfig.entryTtl(Duration.ofMinutes(30)),
                "promotions",   defaultConfig.entryTtl(Duration.ofMinutes(5)),
                "banners",      defaultConfig.entryTtl(Duration.ofMinutes(30))
        );

        log.info("Redis is reachable — using RedisCacheManager with Spring ObjectMapper.");
        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(defaultConfig.entryTtl(Duration.ofMinutes(15)))
                .withInitialCacheConfigurations(cacheConfigs)
                .build();
    }

    /**
     * Distributed rate-limit proxy manager backed by Redis (Lettuce).
     * Used by {@code RateLimitFilter} for multi-instance consistency.
     *
     * <p>Spring does not allow {@code null} {@code @Bean} return values, so we wrap
     * the result in an {@link java.util.Optional}. {@code SecurityConfig} injects it
     * as {@code Optional<ProxyManager<byte[]>>} and unwraps it.
     */
    @Bean
    public java.util.Optional<ProxyManager<byte[]>> bucketProxyManager(
            RedisConnectionFactory connectionFactory) {
        if (!(connectionFactory instanceof LettuceConnectionFactory lettuceFactory)) {
            log.warn("RateLimiter: connection factory is not Lettuce — using in-memory buckets");
            return java.util.Optional.empty();
        }
        try {
            connectionFactory.getConnection().ping();
            RedisClient redisClient = (RedisClient) lettuceFactory.getNativeClient();
            return java.util.Optional.of(
                    LettuceBasedProxyManager.builderFor(redisClient).build());
        } catch (Exception ex) {
            log.warn("RateLimiter: Redis not reachable ({}). Falling back to in-memory buckets.", ex.getMessage());
            return java.util.Optional.empty();
        }
    }

    /**
     * By default Spring's {@code SimpleCacheErrorHandler} rethrows any exception
     * raised while reading/writing/evicting a cache entry, which turns a single
     * corrupted or incompatible Redis value into a 500 for every request that hits
     * that cache key (this is exactly what happened with the stale "productLists"
     * entry above). Overriding it here means a bad cache entry is logged and
     * treated as a miss — the request falls through to the real DB query instead
     * of failing outright. This matters most under load (many concurrent requests
     * hitting the same hot key): one bad value can no longer cascade into a
     * site-wide outage for that endpoint.
     */
    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                log.warn("Cache GET failed for cache='{}' key='{}' — treating as cache miss: {}",
                        cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                log.warn("Cache PUT failed for cache='{}' key='{}': {}",
                        cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                log.warn("Cache EVICT failed for cache='{}' key='{}': {}",
                        cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                log.warn("Cache CLEAR failed for cache='{}': {}", cache.getName(), exception.getMessage());
            }
        };
    }
}
