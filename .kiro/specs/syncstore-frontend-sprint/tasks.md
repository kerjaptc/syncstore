# Implementation Plan - SyncStore Frontend Sprint

- [x] 1. Set up dashboard page structure and product API



  - Create dashboard page at `src/app/dashboard/products/page.tsx` with basic layout
  - Implement API route `src/app/api/products/route.ts` to fetch real products from database
  - Add pagination support with query parameters (page, limit)
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 1.1 Create ProductTable component with real data display

  - Build ProductTable component using shadcn/ui Table
  - Display columns: ID, Title, Master Price, Shopee Price, Status, Sync Button
  - Implement responsive design for mobile and desktop
  - Add loading skeleton and error boundary
  - _Requirements: 1.1, 1.2, 1.5_

- [x] 1.2 Implement pagination and data fetching

  - Create pagination component with navigation controls
  - Add useProducts hook for data fetching and state management
  - Ensure page loads in under 2 seconds with real database data
  - Handle loading states and error conditions
  - _Requirements: 1.1, 1.3, 1.4_

- [ ]* 1.3 Write unit tests for ProductTable and pagination
  - Create tests for ProductTable component rendering
  - Test pagination navigation and data fetching
  - Verify responsive behavior and error handling
  - _Requirements: 1.1, 1.4, 1.5_

- [ ] 2. Implement sync button functionality and user feedback
  - Create SyncButton component with loading, success, and error states
  - Implement API route `src/app/api/sync/product/route.ts` for individual product sync
  - Add toast notification system using shadcn/ui Toast
  - Handle async sync operations with proper state management
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 2.1 Create SyncButton component with state management
  - Build button component with dynamic states (idle, loading, success, error)
  - Add spinner animation and color changes based on state
  - Implement 3-second success state display before returning to idle
  - Create useSync hook for API calls and state management
  - _Requirements: 2.1, 2.3, 2.4, 2.5_

- [ ] 2.2 Implement toast notification system
  - Set up shadcn/ui Toast provider and components
  - Create success and error toast notifications
  - Ensure toasts appear immediately after sync operations
  - Add proper toast positioning and auto-dismiss functionality
  - _Requirements: 2.3, 2.4_

- [ ]* 2.3 Write unit tests for sync functionality
  - Test SyncButton component state transitions
  - Mock API calls and verify proper error handling
  - Test toast notification display and timing
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 3. Add sync status tracking and timestamp display
  - Extend database schema with sync status and timestamp columns
  - Create StatusBadge component with conditional styling
  - Implement RelativeTime component for timestamp display
  - Add error tooltip functionality for failed syncs
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3.1 Create StatusBadge component with color coding
  - Build badge component with status-based colors (gray, yellow, green, red)
  - Add spinner animation for "syncing" status
  - Implement hover tooltip for error status with error details
  - Ensure badges update immediately after sync operations
  - _Requirements: 3.1, 3.3, 3.4_

- [ ] 3.2 Implement timestamp display and database updates
  - Create RelativeTime component showing "X minutes ago" format
  - Update product sync status and timestamp in database after sync
  - Ensure status information persists across page refreshes
  - Add proper timezone handling for timestamps
  - _Requirements: 3.2, 3.4, 3.5_

- [ ]* 3.3 Write unit tests for status and timestamp components
  - Test StatusBadge rendering for all status types
  - Test RelativeTime component with various timestamp inputs
  - Verify database updates and status persistence
  - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [ ] 4. Create progress bar and real-time sync log viewer
  - Implement global progress bar component for sync operations
  - Create SyncLogDrawer component with expandable log viewer
  - Add real-time event polling and display system
  - Implement auto-scroll functionality for log entries
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 4.1 Build progress bar and sync log infrastructure
  - Create ProgressBar component using shadcn/ui Progress
  - Implement sync_logs database table and API endpoints
  - Create SyncLogDrawer component with shadcn/ui Drawer
  - Add LogEntry component for individual event display
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 4.2 Implement real-time log polling and updates
  - Create API route `src/app/api/sync/logs/[sync_id]/route.ts`
  - Implement polling mechanism with 500ms intervals during active sync
  - Add auto-scroll to bottom functionality for new log entries
  - Stop polling automatically when sync operations complete
  - _Requirements: 4.3, 4.4, 4.5_

- [ ]* 4.3 Write unit tests for progress and logging components
  - Test ProgressBar component with various progress states
  - Test SyncLogDrawer opening, closing, and event display
  - Mock polling functionality and verify proper cleanup
  - _Requirements: 4.1, 4.2, 4.4, 4.5_

- [ ] 5. Implement comprehensive error handling and user feedback
  - Create error message mapping for common sync failures
  - Implement ErrorToast component with expandable details
  - Add retry functionality for recoverable errors
  - Create ErrorBoundary component for React error catching
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 5.1 Create error handling system with user-friendly messages
  - Build error message dictionary with user-friendly translations
  - Implement ErrorToast component with expandable technical details
  - Add retry button functionality for retryable errors
  - Ensure error information persists in sync logs
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [ ] 5.2 Implement ErrorBoundary and error recovery
  - Create React ErrorBoundary component for catching component errors
  - Add error recovery mechanisms and fallback UI
  - Implement proper error logging and reporting
  - Test error scenarios with intentional failures
  - _Requirements: 5.1, 5.4_

- [ ]* 5.3 Write unit tests for error handling components
  - Test ErrorToast component with various error types
  - Test retry functionality and error recovery
  - Verify ErrorBoundary catches and handles React errors
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 6. Implement batch sync functionality and Shopee verification
  - Add product selection functionality to ProductTable
  - Create batch sync API endpoint and processing logic
  - Implement batch progress tracking and status updates
  - Enable verification workflow with Shopee seller center
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 6.1 Create product selection and batch sync UI
  - Add checkbox selection to ProductTable rows
  - Create "Sync Selected Products" button with batch functionality
  - Implement batch sync progress display with individual product status
  - Ensure batch operations complete within 2-minute performance requirement
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 6.2 Implement batch sync processing and verification
  - Create batch sync API endpoint handling multiple products
  - Add concurrent sync processing with proper error handling
  - Update all product statuses to "synced" upon successful completion
  - Document verification process for Shopee seller center matching
  - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [ ]* 6.3 Write unit tests for batch sync functionality
  - Test product selection and batch operation triggering
  - Test batch sync processing and progress tracking
  - Verify proper error handling during batch operations
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 7. Conduct comprehensive code audit and browser verification
  - Review all components for production readiness and real data usage
  - Perform end-to-end browser testing of all functionality
  - Verify no console errors or warnings during operation
  - Ensure owner can demonstrate system without developer assistance
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 7.1 Code audit for production readiness
  - Review all components to ensure no dummy or mock data usage
  - Verify all API endpoints connect to real database
  - Check for console errors, warnings, and dead code
  - Ensure all functions perform their claimed operations
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 7.2 Browser testing and owner verification
  - Test complete user workflow from product list to sync completion
  - Verify responsive design on mobile and desktop browsers
  - Ensure system works without requiring backend access or developer help
  - Validate owner can demonstrate functionality to business partners
  - _Requirements: 7.2, 7.4, 7.5_

- [ ]* 7.3 Write integration tests for complete workflows
  - Create end-to-end tests for full sync workflows
  - Test cross-browser compatibility and responsive behavior
  - Verify performance requirements and error handling
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_