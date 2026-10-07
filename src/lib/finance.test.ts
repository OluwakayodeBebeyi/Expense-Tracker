import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { calculateBalance, generateTransactionId, getPeriodSummary } from './finance';

describe('financial helpers', () => {
  it('calculates balance correctly', () => {
    expect(calculateBalance(500000, 220000)).toBe(280000);
  });

  it('generates unique income ids with year and sequence', () => {
    expect(generateTransactionId('income', 2026, 1)).toBe('INC-2026-000001');
    expect(generateTransactionId('expense', 2026, 12)).toBe('EXP-2026-000012');
  });

  it('summarises periods with income, expenditure and balance', () => {
    expect(getPeriodSummary(1000, 300)).toEqual({ income: 1000, expenditure: 300, balance: 700, transactionCount: 2 });
  });

  it('renders a landing page at the root route', () => {
    const html = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/'] }, React.createElement(App)),
    );

    expect(html).toContain('Smart school finance management');
  });
});
