# Testing Guidelines for StoreSync

## Overview

This document outlines the testing patterns and guidelines for the StoreSync project. All tests should follow these patterns to ensure consistency and maintainability.

## Test Structure

### Unit Tests
- **Location**: `src/test/services/`, `src/test/platforms/`, `src/test/utils/`
- **Purpose**: Test individual functions and methods in isolation
- **Coverage Target**: 90%+ for business logic
- **Naming**: `*.test.ts`

### Integration Tests
- **Location**: `src/test/integration/`
- **Purpose**: Test interactions between components
- **Focus**: Database operations, API endpoints, platform integrations

### End-to-End Tests
- **Location**: `src/test/e2e/`
- **Purpose**: Test complete user workflows
- **Tools**: Playwright or similar

## Test Patterns

### Service Layer Tests
```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let mockDependency: MockType;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ServiceName();
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      // Arrange
      const input = createMockInput();
      mockDependency.method.mockResolvedValue(expectedResult);

      // Act
      const result = await service.methodName(input);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockDependency.method).toHaveBeenCalledWith(input);
    });

    it('should handle error case', async () => {
      // Arrange
      mockDependency.method.mockRejectedValue(new Error('Test error'));

      // Act & Assert
      await expect(service.methodName(input)).rejects.toThrow(AppError);
    });
  });
});
```

### Platform Adapter Tests
```typescript
describe('PlatformAdapter', () => {
  let adapter: PlatformAdapter;
  let mockHttpClient: MockHttpClient;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new PlatformAdapter();
  });

  describe('API method', () => {
    it('should handle successful API response', async () => {
      // Mock API response
      mockHttpClient.get.mockResolvedValue({
        data: mockApiResponse,
        status: 200,
      });

      const result = await adapter.fetchData(connection);

      expect(result).toEqual(expectedTransformedData);
    });

    it('should handle API rate limiting', async () => {
      // Test rate limiting behavior
    });

    it('should handle API errors', async () => {
      // Test error handling
    });
  });
});
```

## Test Data Factories

Use the factory functions in `src/test/factories/` to create consistent test data:

```typescript
import { createMockProduct, createMockStore } from '../factories';

const product = createMockProduct({
  name: 'Custom Product Name',
  sku: 'CUSTOM-SKU',
});
```

## Security Testing

All tests should include security-focused test cases:

```typescript
describe('security tests', () => {
  it('should sanitize input data', async () => {
    const maliciousInput = '<script>alert("xss")</script>';
    // Test that input is properly sanitized
  });

  it('should validate authorization', async () => {
    // Test that unauthorized access is prevented
  });

  it('should prevent SQL injection', async () => {
    // Test SQL injection prevention
  });
});
```

## Performance Testing

Include performance benchmarks for critical functions:

```typescript
describe('performance tests', () => {
  it('should handle large datasets efficiently', async () => {
    const startTime = Date.now();
    
    // Perform operation with large dataset
    await service.bulkOperation(largeDataset);
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });
});
```

## Mocking Guidelines

### Database Mocking
```typescript
const mockDb = {
  table: {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({ db: mockDb }));
```

### HTTP Client Mocking
```typescript
const mockHttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/lib/http-client', () => ({ httpClient: mockHttpClient }));
```

### External Service Mocking
```typescript
const mockExternalService = {
  method: vi.fn(),
};

vi.mock('@/lib/services/external-service', () => ({ 
  externalService: mockExternalService 
}));
```

## Error Testing

Test all error scenarios:

```typescript
describe('error handling', () => {
  it('should handle validation errors', async () => {
    const invalidInput = {};
    await expect(service.method(invalidInput)).rejects.toThrow(AppError);
  });

  it('should handle network errors', async () => {
    mockHttpClient.get.mockRejectedValue(new Error('Network error'));
    await expect(adapter.fetchData()).rejects.toThrow(AppError);
  });

  it('should handle database errors', async () => {
    mockDb.table.create.mockRejectedValue(new Error('Database error'));
    await expect(service.create(data)).rejects.toThrow(AppError);
  });
});
```

## Test Coverage Requirements

- **Unit Tests**: 90%+ coverage for business logic
- **Integration Tests**: Cover all API endpoints and database operations
- **E2E Tests**: Cover critical user journeys

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- product-service.test.ts

# Run tests matching pattern
npm test -- --grep "validation"
```

## Continuous Integration

Tests are automatically run on:
- Pull requests
- Commits to main branch
- Nightly builds

All tests must pass before code can be merged.

## Best Practices

1. **Arrange, Act, Assert**: Structure tests clearly
2. **One assertion per test**: Keep tests focused
3. **Descriptive test names**: Make intent clear
4. **Mock external dependencies**: Keep tests isolated
5. **Test edge cases**: Include boundary conditions
6. **Performance awareness**: Include timing assertions for critical paths
7. **Security focus**: Always test input validation and authorization
8. **Clean up**: Use beforeEach/afterEach for test isolation

## Common Pitfalls

1. **Don't test implementation details**: Test behavior, not internals
2. **Avoid brittle tests**: Don't over-specify mock calls
3. **Don't ignore async**: Always await async operations
4. **Mock at the right level**: Mock external boundaries, not internal logic
5. **Keep tests fast**: Use mocks to avoid slow operations

## Tools and Libraries

- **Test Runner**: Vitest
- **Mocking**: Vitest built-in mocks
- **Assertions**: Vitest expect
- **Test Data**: @faker-js/faker
- **Coverage**: v8
- **E2E**: Playwright (when implemented)