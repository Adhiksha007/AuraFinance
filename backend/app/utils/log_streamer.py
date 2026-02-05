"""
Centralized log streaming utility for Server-Sent Events (SSE).
Captures logger messages from any Python logger and streams them to frontend.

Usage:
    # Backend
    streamer = LogStreamer()
    streamer.attach_to_logger('my_module_name')
    streamer.start()
    
    # Your code with logger.info() calls
    logger.info("Processing...")
    
    # In SSE endpoint
    while True:
        msg = streamer.get_message()
        if msg:
            yield f"data: {msg}\n\n"
    
    streamer.stop()
"""
import logging
from queue import Queue, Empty
from typing import Optional, List
import threading


class LogStreamHandler(logging.Handler):
    """
    Custom logging handler that captures log records into a queue for streaming.
    Thread-safe and supports multiple concurrent streams.
    """
    
    def __init__(self, level=logging.INFO):
        super().__init__(level)
        self.queue = Queue()
        self.active = False
        self._lock = threading.Lock()
    
    def emit(self, record):
        """Add log record to queue if streaming is active."""
        if self.active:
            try:
                log_message = self.format(record)
                self.queue.put(log_message)
            except Exception:
                self.handleError(record)
    
    def start(self):
        """Start capturing logs and clear any old messages."""
        with self._lock:
            self.active = True
            # Clear any old messages
            while not self.queue.empty():
                try:
                    self.queue.get_nowait()
                except Empty:
                    break
    
    def stop(self):
        """Stop capturing logs."""
        with self._lock:
            self.active = False
    
    def get_message(self, timeout: float = 0.1) -> Optional[str]:
        """
        Get next log message from queue.
        
        Args:
            timeout: Maximum time to wait for a message (seconds)
            
        Returns:
            Log message string or None if queue is empty
        """
        try:
            return self.queue.get(timeout=timeout)
        except Empty:
            return None
    
    def clear(self):
        """Clear all pending messages from queue."""
        while not self.queue.empty():
            try:
                self.queue.get_nowait()
            except Empty:
                break


class LogStreamer:
    """
    Centralized log streamer for SSE.
    Manages log capture from multiple loggers and provides streaming interface.
    """
    
    def __init__(self, format_string: str = '%(message)s', suppress_console: bool = False):
        """
        Initialize log streamer.
        
        Args:
            format_string: Logging format string (default: just the message)
            suppress_console: If True, prevents logs from appearing in backend console
        """
        self.handler = LogStreamHandler()
        self.handler.setFormatter(logging.Formatter(format_string))
        self.attached_loggers: List[logging.Logger] = []
        self.suppress_console = suppress_console
        self._lock = threading.Lock()
        self._original_handlers: dict = {}
    
    def attach_to_logger(self, logger_name: str, level: int = logging.INFO):
        """
        Attach streamer to a specific logger.
        
        Args:
            logger_name: Name of the logger (e.g., 'app.services.quantum_service')
            level: Minimum log level to capture
            
        Example:
            streamer.attach_to_logger('app.services.quantum_service')
            streamer.attach_to_logger('app.services.backtesting_service')
        """
        with self._lock:
            logger = logging.getLogger(logger_name)
            logger.setLevel(level)
            
            # Store original handlers if suppressing console
            if self.suppress_console and logger_name not in self._original_handlers:
                self._original_handlers[logger_name] = logger.handlers.copy()
            
            logger.addHandler(self.handler)
            self.attached_loggers.append(logger)
    
    def detach_all(self):
        """Remove handler from all attached loggers and restore original handlers."""
        with self._lock:
            for logger in self.attached_loggers:
                logger.removeHandler(self.handler)
                
                # Restore original handlers if they were stored
                logger_name = logger.name
                if logger_name in self._original_handlers:
                    logger.handlers = self._original_handlers[logger_name]
                    del self._original_handlers[logger_name]
            
            self.attached_loggers.clear()
    
    def start(self):
        """Start capturing logs. Optionally suppress console output."""
        self.handler.start()
        
        # If suppressing console, remove other handlers temporarily
        if self.suppress_console:
            with self._lock:
                for logger in self.attached_loggers:
                    # Remove all handlers except our stream handler
                    handlers_to_remove = [h for h in logger.handlers if h != self.handler]
                    for handler in handlers_to_remove:
                        logger.removeHandler(handler)
    
    def stop(self):
        """Stop capturing logs and restore console output if it was suppressed."""
        self.handler.stop()
        
        # Restore original handlers if console was suppressed
        if self.suppress_console:
            with self._lock:
                for logger in self.attached_loggers:
                    logger_name = logger.name
                    if logger_name in self._original_handlers:
                        # Re-add original handlers
                        for handler in self._original_handlers[logger_name]:
                            if handler not in logger.handlers:
                                logger.addHandler(handler)
    
    def get_message(self, timeout: float = 0.1) -> Optional[str]:
        """
        Get next log message.
        
        Args:
            timeout: Maximum time to wait for a message
            
        Returns:
            Log message or None
        """
        return self.handler.get_message(timeout)
    
    def clear(self):
        """Clear all pending messages."""
        self.handler.clear()
    
    def __enter__(self):
        """Context manager entry."""
        self.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.stop()
        return False


# Global singleton instance for convenience
_global_streamer: Optional[LogStreamer] = None
_global_lock = threading.Lock()


def get_global_streamer(suppress_console: bool = True) -> LogStreamer:
    """
    Get or create the global log streamer instance.
    Pre-configured for quantum_service logger.
    
    Args:
        suppress_console: If True, logs won't appear in backend console (default: True)
    
    Returns:
        Global LogStreamer instance
    """
    global _global_streamer
    
    with _global_lock:
        if _global_streamer is None:
            _global_streamer = LogStreamer(suppress_console=suppress_console)
            # Attach to commonly used loggers
            _global_streamer.attach_to_logger('app.api.v1.quantum_portfolio')
            _global_streamer.attach_to_logger('app.services.backtesting_service')
        
        return _global_streamer


def create_streamer(logger_names: List[str], format_string: str = '%(message)s', suppress_console: bool = True) -> LogStreamer:
    """
    Create a new log streamer for specific loggers.
    
    Args:
        logger_names: List of logger names to attach to
        format_string: Log format string
        suppress_console: If True, logs won't appear in backend console (default: True)
        
    Returns:
        New LogStreamer instance
        
    Example:
        streamer = create_streamer(
            ['app.services.quantum_service'],
            suppress_console=True  # Only send to frontend, not backend console
        )
        
        with streamer:
            # Your code here
            while True:
                msg = streamer.get_message()
                if msg:
                    yield f"data: {msg}\n\n"
    """
    streamer = LogStreamer(format_string, suppress_console=suppress_console)
    for logger_name in logger_names:
        streamer.attach_to_logger(logger_name)
    return streamer
