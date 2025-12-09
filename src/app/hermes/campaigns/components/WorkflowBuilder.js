'use client';

import { useCallback, useState, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getShortlinks } from '@/lib/actions/shortlinks';
import styles from './WorkflowBuilder.module.css';

// Custom Node Types
const TriggerNode = ({ data, selected }) => {
  return (
    <div className={`${styles.node} ${styles.triggerNode} ${selected ? styles.selected : ''}`}>
      <div className={styles.nodeHeader}>
        <span className={styles.nodeIcon}>⚡</span>
        <span className={styles.nodeTitle}>New Lead</span>
      </div>
      <div className={styles.nodeBody}>
        <div className={styles.nodeDescription}>Triggered when a new contact is created</div>
      </div>
      <Handle type="source" position={Position.Bottom} className={styles.nodeHandle} id="source" />
    </div>
  );
};

const ActionNode = ({ data, selected, id, onDelete, availableShortlinks = [] }) => {
  const handleShortlinkInsert = (e) => {
    e.stopPropagation();
    const shortlink = availableShortlinks.find(s => s.id === parseInt(e.target.value));
    if (shortlink) {
      // Insert marker format that will be replaced with code when sending
      const shortlinkMarker = `{{SHORTLINK:${shortlink.id}}}`;
      const currentMessage = data.message || '';
      data.onChange?.('message', currentMessage + (currentMessage ? ' ' : '') + shortlinkMarker);
      e.target.value = '';
    }
  };

  return (
    <div className={`${styles.node} ${styles.actionNode} ${selected ? styles.selected : ''}`}>
      <div className={styles.nodeHeader}>
        <span className={styles.nodeIcon}>📤</span>
        <span className={styles.nodeTitle}>Send Message</span>
        {id !== '1' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(id);
            }}
            className={styles.deleteNodeButton}
            title="Delete node"
          >
            ×
          </button>
        )}
      </div>
      <div className={styles.nodeBody}>
        <div className={styles.nodeField}>
          <div className={styles.messageHeader}>
            <label>Message:</label>
            {availableShortlinks.length > 0 && (
              <select
                onChange={handleShortlinkInsert}
                className={styles.shortlinkSelect}
                onClick={(e) => e.stopPropagation()}
                defaultValue=""
              >
                <option value="">Insert Shortlink...</option>
                {availableShortlinks.map(shortlink => (
                  <option key={shortlink.id} value={shortlink.id}>
                    {shortlink.nickname || `Shortlink #${shortlink.id}`}
                  </option>
                ))}
              </select>
            )}
          </div>
          <textarea
            value={data.message || ''}
            onChange={(e) => data.onChange?.('message', e.target.value)}
            placeholder="Enter message text..."
            rows={3}
            className={styles.nodeInput}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
      <Handle type="target" position={Position.Left} className={styles.nodeHandle} id="target" />
      <Handle type="source" position={Position.Right} className={styles.nodeHandle} id="source" />
    </div>
  );
};

const SegmentationNode = ({ data, selected, id, onDelete }) => {
  const [conditions, setConditions] = useState(data.conditions || []);

  useEffect(() => {
    if (data.conditions) {
      setConditions(data.conditions);
    }
  }, [data.conditions]);

  const addCondition = () => {
    const newCondition = { field: '', operator: 'equals', value: '' };
    const updated = [...conditions, newCondition];
    setConditions(updated);
    data.onChange?.('conditions', updated);
  };

  const updateCondition = (index, field, value) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };
    setConditions(updated);
    data.onChange?.('conditions', updated);
  };

  const removeCondition = (index) => {
    const updated = conditions.filter((_, i) => i !== index);
    setConditions(updated);
    data.onChange?.('conditions', updated);
  };

  return (
    <div className={`${styles.node} ${styles.segmentationNode} ${selected ? styles.selected : ''}`}>
      <div className={styles.nodeHeader}>
        <span className={styles.nodeIcon}>🔀</span>
        <span className={styles.nodeTitle}>Segment Contacts</span>
        {id !== '1' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(id);
            }}
            className={styles.deleteNodeButton}
            title="Delete node"
          >
            ×
          </button>
        )}
      </div>
      <div className={styles.nodeBody}>
        <div className={styles.conditionsList}>
          {conditions.map((condition, index) => (
            <div key={index} className={styles.conditionRow}>
              <select
                value={condition.field}
                onChange={(e) => updateCondition(index, 'field', e.target.value)}
                className={styles.conditionSelect}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">Select field...</option>
                <option value="source">Source</option>
                <option value="age">Age</option>
                <option value="subscribed">Subscribed</option>
                <option value="tags">Tags</option>
                <option value="clickid">Click ID</option>
              </select>
              <select
                value={condition.operator}
                onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                className={styles.conditionSelect}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="equals">Equals</option>
                <option value="contains">Contains</option>
                <option value="notEquals">Not Equals</option>
              </select>
              <input
                type="text"
                value={condition.value}
                onChange={(e) => updateCondition(index, 'value', e.target.value)}
                placeholder="Value"
                className={styles.conditionInput}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeCondition(index);
                }}
                className={styles.removeButton}
              >
                ×
              </button>
            </div>
          ))}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              addCondition();
            }} 
            className={styles.addConditionButton}
          >
            + Add Condition
          </button>
        </div>
      </div>
      <Handle type="target" position={Position.Top} className={styles.nodeHandle} id="target" />
      <Handle type="source" position={Position.Bottom} className={styles.nodeHandle} id="source-true" />
      <Handle type="source" position={Position.Right} className={styles.nodeHandle} id="source-false" />
      <div className={styles.handleLabel} style={{ position: 'absolute', bottom: '-1.5rem', left: 'calc(50% + 10px)', transform: 'translateX(-50%)' }}>YES</div>
      <div className={styles.handleLabel} style={{ position: 'absolute', right: '-3rem', top: '50%', transform: 'translateY(-50%)' }}>NO</div>
    </div>
  );
};

const DelayNode = ({ data, selected, id, onDelete }) => {
  const [delayValue, setDelayValue] = useState(data.delayValue || '');
  const [delayUnit, setDelayUnit] = useState(data.delayUnit || 'minutes');

  useEffect(() => {
    if (data.delayValue !== undefined) setDelayValue(data.delayValue);
    if (data.delayUnit) setDelayUnit(data.delayUnit);
  }, [data.delayValue, data.delayUnit]);

  const handleValueChange = (e) => {
    const value = e.target.value;
    setDelayValue(value);
    data.onChange?.('delayValue', value);
  };

  const handleUnitChange = (e) => {
    const unit = e.target.value;
    setDelayUnit(unit);
    data.onChange?.('delayUnit', unit);
  };

  return (
    <div className={`${styles.node} ${styles.delayNode} ${selected ? styles.selected : ''}`}>
      <div className={styles.nodeHeader}>
        <span className={styles.nodeIcon}>⏱️</span>
        <span className={styles.nodeTitle}>Time Delay</span>
        {id !== '1' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(id);
            }}
            className={styles.deleteNodeButton}
            title="Delete node"
          >
            ×
          </button>
        )}
      </div>
      <div className={styles.nodeBody}>
        <div className={styles.nodeField}>
          <label>Delay:</label>
          <div className={styles.delayInputGroup}>
            <input
              type="number"
              value={delayValue}
              onChange={handleValueChange}
              placeholder="0"
              min="0"
              className={styles.delayInput}
              onClick={(e) => e.stopPropagation()}
            />
            <select
              value={delayUnit}
              onChange={handleUnitChange}
              className={styles.delayUnitSelect}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
            </select>
          </div>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className={styles.nodeHandle} id="target" />
      <Handle type="source" position={Position.Right} className={styles.nodeHandle} id="source" />
    </div>
  );
};

const createNodeTypes = (onDelete, availableShortlinks = []) => ({
  trigger: TriggerNode,
  action: (props) => <ActionNode {...props} onDelete={onDelete} availableShortlinks={availableShortlinks} />,
  segmentation: (props) => <SegmentationNode {...props} onDelete={onDelete} />,
  delay: (props) => <DelayNode {...props} onDelete={onDelete} />,
});

const initialNodes = [
  {
    id: '1',
    type: 'trigger',
    position: { x: 250, y: 100 },
    data: { label: 'New Lead' },
  },
];

const initialEdges = [];

export default function WorkflowBuilder({ workflow, onSave, campaignId, campaignName, onCampaignNameChange }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow?.nodes || initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow?.edges || initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [availableShortlinks, setAvailableShortlinks] = useState([]);

  useEffect(() => {
    const loadShortlinks = async () => {
      try {
        const shortlinks = await getShortlinks();
        setAvailableShortlinks(shortlinks);
      } catch (error) {
        console.error('Error loading shortlinks:', error);
      }
    };
    loadShortlinks();
  }, []);

  const handleDeleteNode = useCallback((nodeId) => {
    if (nodeId === '1') return; // Don't allow deleting trigger node
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNodeId(null);
    setEditingNode(null);
  }, [setNodes, setEdges]);

  // Handle keyboard deletion
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId && selectedNodeId !== '1') {
        e.preventDefault();
        handleDeleteNode(selectedNodeId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, handleDeleteNode]);

  const onConnect = useCallback(
    (params) => {
      // Prevent connecting trigger node as target
      if (params.target === '1') {
        return;
      }
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onNodesDelete = useCallback((deleted) => {
    const deletedIds = deleted.map((n) => n.id);
    setNodes((nds) => nds.filter((node) => !deletedIds.includes(node.id)));
    setEdges((eds) => eds.filter((edge) => !deletedIds.includes(edge.source) && !deletedIds.includes(edge.target)));
  }, [setNodes, setEdges]);

  const onNodeClick = useCallback((event, node) => {
    setSelectedNodeId(node.id);
    setEditingNode(null);
  }, []);

  const onNodeDoubleClick = useCallback((event, node) => {
    if (node.id !== '1') { // Don't allow editing trigger node
      setEditingNode(node);
    }
  }, []);

  const onNodeDataChange = useCallback((nodeId, field, value) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              [field]: value,
              onChange: (f, v) => onNodeDataChange(nodeId, f, v),
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Update nodes with onChange handlers and delete function
  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
      data: {
        ...node.data,
        onChange: (field, value) => onNodeDataChange(node.id, field, value),
      },
    }));
  }, [nodes, onNodeDataChange, selectedNodeId]);

  const addNode = (type) => {
    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 400 + 200, y: Math.random() * 400 + 200 },
      data: { 
        label: type === 'trigger' ? 'New Lead' 
          : type === 'action' ? 'Send Message' 
          : type === 'segmentation' ? 'Segment Contacts'
          : 'Time Delay',
        message: type === 'action' ? '' : undefined,
        conditions: type === 'segmentation' ? [] : undefined,
        delayValue: type === 'delay' ? '' : undefined,
        delayUnit: type === 'delay' ? 'minutes' : undefined,
        onChange: (field, value) => onNodeDataChange(newNode.id, field, value),
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleSave = () => {
    // Clean up nodes before saving (remove onChange handlers and React Flow internal props)
    const cleanNodes = nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        message: node.data?.message,
        conditions: node.data?.conditions,
        delayValue: node.data?.delayValue,
        delayUnit: node.data?.delayUnit,
        label: node.data?.label,
      },
    }));
    
    const workflowData = {
      nodes: cleanNodes,
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      })),
    };
    onSave(workflowData);
  };

  const nodeTypes = useMemo(() => createNodeTypes(handleDeleteNode, availableShortlinks), [handleDeleteNode, availableShortlinks]);

  const workflowStats = useMemo(() => {
    const actionNodes = nodes.filter(n => n.type === 'action').length;
    const segmentationNodes = nodes.filter(n => n.type === 'segmentation').length;
    const totalConnections = edges.length;
    return { actionNodes, segmentationNodes, totalConnections, totalNodes: nodes.length };
  }, [nodes, edges]);

  return (
    <div className={styles.workflowBuilder}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.nameInputGroup}>
            <label htmlFor="campaignName">Campaign Name</label>
            <input
              id="campaignName"
              type="text"
              value={campaignName || ''}
              onChange={(e) => onCampaignNameChange?.(e.target.value)}
              placeholder="Enter campaign name"
              className={styles.campaignNameInput}
            />
          </div>
          <div className={styles.nodePalette}>
            <h3>Add Node</h3>
            <button onClick={() => addNode('action')} className={styles.paletteButton}>
              📤 Send Message
            </button>
            <button onClick={() => addNode('segmentation')} className={styles.paletteButton}>
              🔀 Segment Contacts
            </button>
            <button onClick={() => addNode('delay')} className={styles.paletteButton}>
              ⏱️ Time Delay
            </button>
          </div>
        </div>
        <div className={styles.workflowStats}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Nodes:</span>
            <span className={styles.statValue}>{workflowStats.totalNodes}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Actions:</span>
            <span className={styles.statValue}>{workflowStats.actionNodes}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Segments:</span>
            <span className={styles.statValue}>{workflowStats.segmentationNodes}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Connections:</span>
            <span className={styles.statValue}>{workflowStats.totalConnections}</span>
          </div>
        </div>
        <div className={styles.actions}>
          <button onClick={handleSave} className={styles.saveButton}>
            Save Workflow
          </button>
        </div>
      </div>
      <div className={styles.canvas}>
        <ReactFlow
          nodes={nodesWithHandlers}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodesDelete={onNodesDelete}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
          connectionLineStyle={{ stroke: '#ff6b35', strokeWidth: 2 }}
          defaultEdgeOptions={{
            style: { strokeWidth: 2, stroke: '#ff6b35' },
            type: 'smoothstep',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#ff6b35',
            },
          }}
          deleteKeyCode={['Delete', 'Backspace']}
          multiSelectionKeyCode={['Meta', 'Control']}
        >
          <Background />
          <Controls className={styles.reactFlowControls} />
          <MiniMap 
            className={styles.reactFlowMinimap}
            nodeColor={(node) => {
              if (node.type === 'trigger') return '#10b981';
              if (node.type === 'action') return '#ff6b35';
              if (node.type === 'segmentation') return '#3b82f6';
              return '#71717a';
            }}
            maskColor="rgba(0, 0, 0, 0.6)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

