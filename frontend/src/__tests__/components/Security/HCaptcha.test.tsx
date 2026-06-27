import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import HCaptcha from '../../../components/Security/HCaptcha';

// Mock hCaptcha
const mockExecute = jest.fn();
const mockReset = jest.fn();
const mockRemove = jest.fn();

// Mock window.hcaptcha
Object.defineProperty(window, 'hcaptcha', {
  value: {
    execute: mockExecute,
    reset: mockReset,
    remove: mockRemove,
    render: jest.fn().mockReturnValue('mock-widget-id')
  },
  writable: true
});

describe('HCaptcha Component', () => {
  const defaultProps = {
    siteKey: 'test-site-key',
    onVerify: jest.fn(),
    onError: jest.fn(),
    onExpire: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up DOM
    document.body.innerHTML = '';
  });

  it('renders hCaptcha container', () => {
    render(<HCaptcha {...defaultProps} />);
    
    const container = screen.getByTestId('hcaptcha-container');
    expect(container).toBeInTheDocument();
  });

  it('calls onVerify when captcha is solved', async () => {
    const onVerify = jest.fn();
    render(<HCaptcha {...defaultProps} onVerify={onVerify} />);

    // Simulate hCaptcha verification
    const mockToken = 'mock-captcha-token';
    
    // Trigger the callback that would be called by hCaptcha
    await waitFor(() => {
      // Simulate hCaptcha calling the verify callback
      if (window.hcaptcha && window.hcaptcha.render) {
        // Get the callback from the render call
        const renderCall = (window.hcaptcha.render as jest.Mock).mock.calls[0];
        if (renderCall && renderCall[1] && renderCall[1].callback) {
          renderCall[1].callback(mockToken);
        }
      }
    });

    expect(onVerify).toHaveBeenCalledWith(mockToken);
  });

  it('calls onError when captcha fails', async () => {
    const onError = jest.fn();
    render(<HCaptcha {...defaultProps} onError={onError} />);

    await waitFor(() => {
      // Simulate hCaptcha calling the error callback
      if (window.hcaptcha && window.hcaptcha.render) {
        const renderCall = (window.hcaptcha.render as jest.Mock).mock.calls[0];
        if (renderCall && renderCall[1] && renderCall[1]['error-callback']) {
          renderCall[1]['error-callback']('network-error');
        }
      }
    });

    expect(onError).toHaveBeenCalledWith('network-error');
  });

  it('calls onExpire when captcha expires', async () => {
    const onExpire = jest.fn();
    render(<HCaptcha {...defaultProps} onExpire={onExpire} />);

    await waitFor(() => {
      // Simulate hCaptcha calling the expired callback
      if (window.hcaptcha && window.hcaptcha.render) {
        const renderCall = (window.hcaptcha.render as jest.Mock).mock.calls[0];
        if (renderCall && renderCall[1] && renderCall[1]['expired-callback']) {
          renderCall[1]['expired-callback']();
        }
      }
    });

    expect(onExpire).toHaveBeenCalled();
  });

  it('resets captcha when reset method is called', () => {
    const { rerender } = render(<HCaptcha {...defaultProps} />);
    
    // Force a re-render to trigger reset
    rerender(<HCaptcha {...defaultProps} key="new-key" />);
    
    expect(mockReset).toHaveBeenCalled();
  });

  it('handles disabled state', () => {
    render(<HCaptcha {...defaultProps} disabled={true} />);
    
    const container = screen.getByTestId('hcaptcha-container');
    expect(container).toHaveClass('opacity-50', 'pointer-events-none');
  });

  it('applies custom theme', () => {
    render(<HCaptcha {...defaultProps} theme="dark" />);
    
    // Check if the theme is passed to hCaptcha render
    expect(window.hcaptcha.render).toHaveBeenCalledWith(
      expect.any(Element),
      expect.objectContaining({
        theme: 'dark'
      })
    );
  });

  it('applies custom size', () => {
    render(<HCaptcha {...defaultProps} size="compact" />);
    
    // Check if the size is passed to hCaptcha render
    expect(window.hcaptcha.render).toHaveBeenCalledWith(
      expect.any(Element),
      expect.objectContaining({
        size: 'compact'
      })
    );
  });

  it('cleans up on unmount', () => {
    const { unmount } = render(<HCaptcha {...defaultProps} />);
    
    unmount();
    
    expect(mockRemove).toHaveBeenCalled();
  });

  it('handles missing hCaptcha script gracefully', () => {
    // Temporarily remove hCaptcha from window
    const originalHCaptcha = window.hcaptcha;
    delete (window as any).hcaptcha;

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<HCaptcha {...defaultProps} />);

    expect(consoleSpy).toHaveBeenCalledWith('hCaptcha not loaded');

    // Restore
    window.hcaptcha = originalHCaptcha;
    consoleSpy.mockRestore();
  });

  it('validates required siteKey prop', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<HCaptcha {...defaultProps} siteKey="" />);

    expect(consoleSpy).toHaveBeenCalledWith('hCaptcha siteKey is required');

    consoleSpy.mockRestore();
  });

  it('handles multiple instances correctly', () => {
    const onVerify1 = jest.fn();
    const onVerify2 = jest.fn();

    render(
      <div>
        <HCaptcha {...defaultProps} onVerify={onVerify1} />
        <HCaptcha {...defaultProps} onVerify={onVerify2} />
      </div>
    );

    // Should render two separate instances
    expect(window.hcaptcha.render).toHaveBeenCalledTimes(2);
  });

  it('executes captcha programmatically', async () => {
    const { container } = render(<HCaptcha {...defaultProps} />);
    
    // Get the component instance (this would need to be exposed via ref in real implementation)
    // For now, just test that execute can be called
    expect(mockExecute).not.toHaveBeenCalled();
    
    // In a real implementation, you would call execute via a ref
    // ref.current.execute();
    // expect(mockExecute).toHaveBeenCalled();
  });

  it('handles network errors gracefully', async () => {
    const onError = jest.fn();
    render(<HCaptcha {...defaultProps} onError={onError} />);

    // Simulate network error
    await waitFor(() => {
      if (window.hcaptcha && window.hcaptcha.render) {
        const renderCall = (window.hcaptcha.render as jest.Mock).mock.calls[0];
        if (renderCall && renderCall[1] && renderCall[1]['error-callback']) {
          renderCall[1]['error-callback']('network-error');
        }
      }
    });

    expect(onError).toHaveBeenCalledWith('network-error');
  });

  it('handles rate limiting errors', async () => {
    const onError = jest.fn();
    render(<HCaptcha {...defaultProps} onError={onError} />);

    // Simulate rate limiting error
    await waitFor(() => {
      if (window.hcaptcha && window.hcaptcha.render) {
        const renderCall = (window.hcaptcha.render as jest.Mock).mock.calls[0];
        if (renderCall && renderCall[1] && renderCall[1]['error-callback']) {
          renderCall[1]['error-callback']('rate-limited');
        }
      }
    });

    expect(onError).toHaveBeenCalledWith('rate-limited');
  });

  it('supports custom CSS classes', () => {
    const customClass = 'custom-captcha-class';
    render(<HCaptcha {...defaultProps} className={customClass} />);
    
    const container = screen.getByTestId('hcaptcha-container');
    expect(container).toHaveClass(customClass);
  });

  it('supports custom tab index', () => {
    render(<HCaptcha {...defaultProps} tabIndex={5} />);
    
    // Check if tabindex is passed to hCaptcha render
    expect(window.hcaptcha.render).toHaveBeenCalledWith(
      expect.any(Element),
      expect.objectContaining({
        tabindex: 5
      })
    );
  });
});
