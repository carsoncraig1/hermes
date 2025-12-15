'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { updateWorkflowCampaign } from '@/lib/actions/campaigns';
import WorkflowBuilder from './WorkflowBuilder';
import styles from './CreateWorkflowCampaign.module.css';

export default function EditWorkflowCampaign({ campaign, onClose }) {
  const router = useRouter();
  const [name, setName] = useState(campaign?.name || '');
  const [workflow, setWorkflow] = useState(campaign?.workflow || null);
  const [saving, setSaving] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const workflowBuilderRef = useRef(null);

  useEffect(() => {
    const checkSidebar = () => {
      const sidebar = document.querySelector('.sidebar');
      setSidebarCollapsed(sidebar?.classList.contains('collapsed') || false);
    };

    // Check on mount
    checkSidebar();

    // Watch for changes
    const observer = new MutationObserver(checkSidebar);
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }

    return () => observer.disconnect();
  }, []);

  const handleSave = (workflowData) => {
    setWorkflow(workflowData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }
    
    // Get the latest workflow state from WorkflowBuilder
    let currentWorkflow = workflow;
    if (workflowBuilderRef.current?.getCurrentWorkflow) {
      const latestWorkflow = workflowBuilderRef.current.getCurrentWorkflow();
      if (latestWorkflow) {
        currentWorkflow = latestWorkflow;
        setWorkflow(latestWorkflow);
      }
    }
    
    if (!currentWorkflow || !currentWorkflow.nodes || currentWorkflow.nodes.length === 0) {
      alert('Workflow must have at least one node');
      return;
    }
    
    // Must have at least one trigger node
    const hasTrigger = currentWorkflow.nodes.some(node => node.type === 'trigger');
    if (!hasTrigger) {
      alert('Workflow must have at least one trigger node. Please add a trigger from the Trigger Nodes section.');
      return;
    }

    setSaving(true);
    try {
      await updateWorkflowCampaign({
        id: campaign.id,
        name,
        workflow: currentWorkflow,
      });
      router.refresh();
      onClose();
    } catch (error) {
      console.error('Error updating campaign:', error);
      alert('Failed to update campaign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className={styles.modalOverlay}
      style={{ 
        left: sidebarCollapsed ? '80px' : '260px',
      }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Edit Sequence Campaign</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.workflowSection}>
            <div className={styles.workflowContainer}>
              <WorkflowBuilder
                ref={workflowBuilderRef}
                workflow={workflow}
                onSave={handleSave}
                campaignId={campaign.id}
                campaignName={name}
                onCampaignNameChange={setName}
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving || !name.trim() || !workflow || !workflow.nodes || workflow.nodes.length === 0 || !workflow.nodes.some(node => node.type === 'trigger')} 
              className={styles.submitButton}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

