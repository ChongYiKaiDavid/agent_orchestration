import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';

interface PipelineVisualizationProps {
  pipeline: {
    id: string;
    name: string;
    stages: Array<{
      id: string;
      name: string;
      agent: string;
      summary: string;
    }>;
  };
  executionStatus?: {
    [stageId: string]: {
      status: string;
      started_at?: string;
      completed_at?: string;
    };
  };
}

const PipelineVisualization: React.FC<PipelineVisualizationProps> = ({ pipeline, executionStatus }) => {
  const { nodes, edges } = useMemo(() => {
    const stageNodes: Node[] = pipeline.stages.map((stage, index) => {
      const status = executionStatus?.[stage.id];
      const statusColor = status?.status === 'completed' ? '#22c55e' 
                        : status?.status === 'running' ? '#3b82f6'
                        : status?.status === 'failed' ? '#ef4444'
                        : '#6b7280';

      return {
        id: stage.id,
        type: 'default',
        position: { x: index * 250, y: 100 },
        data: {
          label: (
            <div style={{ padding: '10px', minWidth: '200px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{stage.name}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Agent: {stage.agent}</div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>{stage.summary}</div>
              {status && (
                <div style={{ 
                  marginTop: '8px', 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  backgroundColor: statusColor + '20',
                  color: statusColor,
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}>
                  {status.status.toUpperCase()}
                </div>
              )}
            </div>
          ),
        },
        style: {
          background: 'white',
          border: `2px solid ${statusColor}`,
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        },
      };
    });

    const stageEdges: Edge[] = [];
    for (let i = 0; i < pipeline.stages.length - 1; i++) {
      stageEdges.push({
        id: `e${pipeline.stages[i].id}-${pipeline.stages[i + 1].id}`,
        source: pipeline.stages[i].id,
        target: pipeline.stages[i + 1].id,
        animated: executionStatus?.[pipeline.stages[i].id]?.status === 'completed' &&
                 executionStatus?.[pipeline.stages[i + 1].id]?.status === 'running',
        style: { stroke: '#6b7280', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#6b7280',
        },
      });
    }

    return { nodes: stageNodes, edges: stageEdges };
  }, [pipeline, executionStatus]);

  return (
    <div style={{ width: '100%', height: '400px', background: '#f8fafc', borderRadius: '8px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#aaa" gap={16} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

export default PipelineVisualization;
