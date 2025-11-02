/**
 * Comprehensive test utilities and helpers for common testing patterns
 */

import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { vi, MockedFunction } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/nextjs';
import { ThemeProvider } from 'next-themes';

// Test wrapper providers
interface TestProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export const TestProviders = ({ children, queryClient }: TestProvidersProps) => {
  const testQueryClient = queryClient || new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return React.createElement(
    ClerkProvider,
    { publishableKey: "pk_test_mock" },
    React.createElement(
      QueryClientProvider,
      { client: testQueryClient },
      React.createElement(
        ThemeProvider,
        { attribute: "class", defaultTheme: "light", enableSystem: false },
        children
      )
    )
  );
};

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  wrapper?: React.ComponentType<any>;
}

export const renderWithProviders = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult => {
  const { queryClient, wrapper, ...renderOptions } = options;

  const Wrapper = wrapper || (({ children }) => 
    React.createElement(TestProviders, { queryClient }, children)
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Mock factory utilities
export const createMockFunction = <T extends (...args: any[]) => any>(
  implementation?: T
): MockedFunction<T> => {
  return vi.fn(implementation) as MockedFunction<T>;
};

// Database test utilities
export const createTestDatabase = () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    execute: vi.fn(),
    query: vi.fn(),
    transaction: vi.fn(),
  };

  return mockDb;
};

// API response mocking utilities
export const createMockApiResponse = <T>(data: T, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  json: vi.fn().mockResolvedValue(data),
  text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  headers: new Headers(),
});

export const mockFetch = (response: any, status = 200) => {
  const mockResponse = createMockApiResponse(response, status);
  (global.fetch as any) = vi.fn().mockResolvedValue(mockResponse);
  return mockResponse;
};

// Platform API mocking utilities
export const createMockShopeeResponse = (data: any) => ({
  error: '',
  message: 'success',
  response: data,
  request_id: 'test-request-id',
});

export const createMockTikTokShopResponse = (data: any) => ({
  code: 0,
  message: 'success',
  data,
  request_id: 'test-request-id',
});

// Error testing utilities
export const createTestError = (message: string, code?: string) => {
  const error = new Error(message);
  if (code) {
    (error as any).code = code;
  }
  return error;
};

export const expectErrorToBeThrown = async (
  fn: () => Promise<any> | any,
  expectedMessage?: string
) => {
  try {
    await fn();
    throw new Error('Expected function to throw an error');
  } catch (error) {
    if (expectedMessage) {
      expect(error).toHaveProperty('message', expectedMessage);
    }
    return error;
  }
};

// Async testing utilities
export const waitForCondition = async (
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
};

export const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// Form testing utilities
export const fillForm = async (form: HTMLFormElement, data: Record<string, string>) => {
  const { fireEvent } = await import('@testing-library/react');
  
  Object.entries(data).forEach(([name, value]) => {
    const input = form.querySelector(`[name="${name}"]`) as HTMLInputElement;
    if (input) {
      fireEvent.change(input, { target: { value } });
    }
  });
};

export const submitForm = async (form: HTMLFormElement) => {
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.submit(form);
};

// Component testing utilities
export const getByTestId = (container: HTMLElement, testId: string) => {
  const element = container.querySelector(`[data-testid="${testId}"]`);
  if (!element) {
    throw new Error(`Element with data-testid="${testId}" not found`);
  }
  return element;
};

export const queryByTestId = (container: HTMLElement, testId: string) => {
  return container.querySelector(`[data-testid="${testId}"]`);
};

// Performance testing utilities
export const measurePerformance = async <T>(
  fn: () => Promise<T> | T,
  label?: string
): Promise<{ result: T; duration: number }> => {
  const startTime = performance.now();
  const result = await fn();
  const duration = performance.now() - startTime;
  
  if (label) {
    console.log(`${label}: ${duration.toFixed(2)}ms`);
  }
  
  return { result, duration };
};

// Memory testing utilities
export const measureMemoryUsage = () => {
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    return {
      used: (performance as any).memory.usedJSHeapSize,
      total: (performance as any).memory.totalJSHeapSize,
      limit: (performance as any).memory.jsHeapSizeLimit,
    };
  }
  return null;
};

// Snapshot testing utilities
export const createSnapshot = (component: ReactElement, name?: string) => {
  const { render } = require('@testing-library/react');
  const { container } = render(component);
  expect(container.firstChild).toMatchSnapshot(name);
};

// Mock timer utilities
export const advanceTimersByTime = (ms: number) => {
  vi.advanceTimersByTime(ms);
};

export const runAllTimers = () => {
  vi.runAllTimers();
};

export const runOnlyPendingTimers = () => {
  vi.runOnlyPendingTimers();
};

// Local storage testing utilities
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    length: Object.keys(store).length,
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
};

// Session storage testing utilities
export const mockSessionStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    length: Object.keys(store).length,
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
};

// URL testing utilities
export const mockLocation = (url: string) => {
  const location = new URL(url);
  Object.defineProperty(window, 'location', {
    value: {
      href: location.href,
      origin: location.origin,
      protocol: location.protocol,
      host: location.host,
      hostname: location.hostname,
      port: location.port,
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      assign: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
    },
    writable: true,
  });
};

// Clipboard testing utilities
export const mockClipboard = () => {
  const clipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  };
  
  Object.defineProperty(navigator, 'clipboard', {
    value: clipboard,
    writable: true,
  });
  
  return clipboard;
};

// File testing utilities
export const createMockFile = (
  name: string,
  content: string,
  type = 'text/plain'
): File => {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
};

// Network testing utilities
export const mockNetworkError = () => {
  (global.fetch as any) = vi.fn().mockRejectedValue(new Error('Network error'));
};

export const mockNetworkDelay = (delay: number) => {
  (global.fetch as any) = vi.fn().mockImplementation(
    () => new Promise(resolve => setTimeout(resolve, delay))
  );
};

// Accessibility testing utilities
export const checkAccessibility = async (container: HTMLElement) => {
  // Basic accessibility checks
  const images = container.querySelectorAll('img');
  images.forEach(img => {
    expect(img).toHaveAttribute('alt');
  });
  
  const buttons = container.querySelectorAll('button');
  buttons.forEach(button => {
    expect(button).toBeEnabled();
  });
  
  const inputs = container.querySelectorAll('input');
  inputs.forEach(input => {
    const label = container.querySelector(`label[for="${input.id}"]`);
    if (!label && !input.getAttribute('aria-label')) {
      console.warn(`Input ${input.id || input.name} missing label`);
    }
  });
};

// Test data cleanup utilities
export const cleanupTestData = () => {
  // Clear all mocks
  vi.clearAllMocks();
  
  // Clear local storage
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }
  
  // Reset fetch mock
  if (global.fetch) {
    (global.fetch as any).mockClear();
  }
};

// Test environment utilities
export const isTestEnvironment = () => process.env.NODE_ENV === 'test';

export const skipInCI = (testFn: () => void) => {
  if (process.env.CI) {
    return () => {}; // Skip test in CI
  }
  return testFn;
};

export const onlyInCI = (testFn: () => void) => {
  if (!process.env.CI) {
    return () => {}; // Skip test outside CI
  }
  return testFn;
};