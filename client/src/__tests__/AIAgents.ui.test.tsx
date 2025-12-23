import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AIAgents from '../pages/AIAgents';

// Create a fresh QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

// Wrapper component with providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('AIAgents Page', () => {
  it('renders the AI Voice Agents heading', () => {
    render(
      <TestWrapper>
        <AIAgents />
      </TestWrapper>
    );
    // Use getByRole to specifically find the h1 heading
    expect(screen.getByRole('heading', { name: /AI Voice Agents/i })).toBeInTheDocument();
  });
});
