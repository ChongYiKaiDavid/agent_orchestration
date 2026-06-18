import { useState } from 'react';

interface TestResultsProps {
  taskId: string;
}

interface TestRun {
  success: boolean;
  message: string;
  framework: string | null;
  exitCode: number | null;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

export default function TestResults({ taskId }: TestResultsProps) {
  const [results, setResults] = useState<TestRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [framework, setFramework] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);

  const detectFramework = async () => {
    try {
      const response = await fetch(`http://localhost:5174/api/tasks/${taskId}/test-framework`);
      const data = await response.json();
      setFramework(data.framework);
    } catch (error) {
      console.error('Failed to detect framework:', error);
    }
  };

  const runTests = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5174/api/tasks/${taskId}/run-tests`, {
        method: 'POST',
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Failed to run tests:', error);
      setResults({
        success: false,
        message: 'Failed to run tests',
        framework: null,
        exitCode: null,
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useState(() => {
    detectFramework();
  });

  const getFrameworkIcon = (fw: string | null) => {
    switch (fw) {
      case 'jest':
        return '🃏';
      case 'vitest':
        return '⚡';
      case 'mocha':
        return '☕';
      case 'pytest':
        return '🐍';
      case 'unittest':
        return '🧪';
      default:
        return '❓';
    }
  };

  const getPassRate = () => {
    if (!results || results.total === 0) return 0;
    return Math.round((results.passed / results.total) * 100);
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Automated Tests</h3>
        <div className="flex items-center gap-2">
          {framework && (
            <span className="text-sm text-gray-400 flex items-center gap-1">
              <span>{getFrameworkIcon(framework)}</span>
              {framework}
            </span>
          )}
          <button
            onClick={runTests}
            disabled={loading}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Running...' : 'Run Tests'}
          </button>
        </div>
      </div>

      {!framework && (
        <div className="text-center text-gray-400 py-4">
          No test framework detected in repository
        </div>
      )}

      {results && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{results.total}</div>
                <div className="text-xs text-gray-400">Total</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{results.passed}</div>
                <div className="text-xs text-gray-400">Passed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">{results.failed}</div>
                <div className="text-xs text-gray-400">Failed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">{results.duration}s</div>
                <div className="text-xs text-gray-400">Duration</div>
              </div>
            </div>
            
            {/* Pass Rate Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Pass Rate</span>
                <span>{getPassRate()}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    results.success ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${getPassRate()}%` }}
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            results.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            <span className="text-xl">{results.success ? '✅' : '❌'}</span>
            <span className="font-medium">
              {results.success ? 'Tests Passed' : 'Tests Failed'}
            </span>
            {results.exitCode !== null && (
              <span className="text-sm opacity-75">
                (Exit code: {results.exitCode})
              </span>
            )}
          </div>

          {/* Output Toggle */}
          <button
            onClick={() => setShowOutput(!showOutput)}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            {showOutput ? 'Hide' : 'Show'} Output
          </button>

          {/* Output */}
          {showOutput && (
            <div className="bg-gray-800 rounded-lg p-4">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                {results.message}
              </pre>
            </div>
          )}
        </div>
      )}

      {!results && framework && (
        <div className="text-center text-gray-400 py-4">
          Click "Run Tests" to execute the test suite
        </div>
      )}
    </div>
  );
}
