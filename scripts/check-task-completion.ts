#!/usr/bin/env tsx

/**
 * Script untuk mengecek kelengkapan semua task dari 1-9.3
 */

import fs from 'fs/promises';

interface TaskItem {
  id: string;
  title: string;
  status: 'completed' | 'incomplete';
  level: number;
  hasSubtasks: boolean;
  subtasks: TaskItem[];
}

async function parseTaskList(): Promise<TaskItem[]> {
  const content = await fs.readFile('.kiro/specs/syncstore-phase1/tasks.md', 'utf8');
  const lines = content.split('\n');
  
  const tasks: TaskItem[] = [];
  let currentMainTask: TaskItem | null = null;
  
  for (const line of lines) {
    // Skip non-task lines
    if (!line.trim().startsWith('- [')) continue;
    
    // Parse task line
    const match = line.match(/^(\s*)- \[([x\s])\] (.+)/);
    if (!match) continue;
    
    const indent = match[1].length;
    const isCompleted = match[2] === 'x';
    const title = match[3].trim();
    
    // Determine task level and ID
    let level = 0;
    let taskId = '';
    
    if (indent === 0) {
      // Main task (level 0)
      level = 0;
      const mainMatch = title.match(/^(\d+(?:\.\d+)*)\.\s*(.+)/);
      if (mainMatch) {
        taskId = mainMatch[1];
        const taskTitle = mainMatch[2];
        
        const task: TaskItem = {
          id: taskId,
          title: taskTitle,
          status: isCompleted ? 'completed' : 'incomplete',
          level,
          hasSubtasks: false,
          subtasks: []
        };
        
        tasks.push(task);
        currentMainTask = task;
      }
    } else if (indent > 0 && currentMainTask) {
      // Subtask (level 1)
      level = 1;
      const subMatch = title.match(/^(\d+(?:\.\d+)+)\s*(.+)/);
      if (subMatch) {
        taskId = subMatch[1];
        const taskTitle = subMatch[2];
        
        const subtask: TaskItem = {
          id: taskId,
          title: taskTitle,
          status: isCompleted ? 'completed' : 'incomplete',
          level,
          hasSubtasks: false,
          subtasks: []
        };
        
        currentMainTask.subtasks.push(subtask);
        currentMainTask.hasSubtasks = true;
      }
    }
  }
  
  return tasks;
}

function generateTaskReport(tasks: TaskItem[]): void {
  console.log('🔍 COMPREHENSIVE TASK COMPLETION CHECK');
  console.log('=====================================\n');
  
  let totalTasks = 0;
  let completedTasks = 0;
  let incompleteTasks = 0;
  
  const incompleteList: string[] = [];
  
  for (const task of tasks) {
    totalTasks++;
    
    const mainStatus = task.status === 'completed' ? '✅' : '❌';
    const statusText = task.status === 'completed' ? 'COMPLETE' : 'INCOMPLETE';
    
    console.log(`${mainStatus} ${task.id}. ${task.title} - ${statusText}`);
    
    if (task.status === 'completed') {
      completedTasks++;
    } else {
      incompleteTasks++;
      incompleteList.push(`${task.id}. ${task.title}`);
    }
    
    // Check subtasks
    if (task.hasSubtasks && task.subtasks.length > 0) {
      let subtaskCompleted = 0;
      let subtaskTotal = task.subtasks.length;
      
      for (const subtask of task.subtasks) {
        totalTasks++;
        
        const subStatus = subtask.status === 'completed' ? '✅' : '❌';
        const subStatusText = subtask.status === 'completed' ? 'COMPLETE' : 'INCOMPLETE';
        
        console.log(`  ${subStatus} ${subtask.id} ${subtask.title} - ${subStatusText}`);
        
        if (subtask.status === 'completed') {
          completedTasks++;
          subtaskCompleted++;
        } else {
          incompleteTasks++;
          incompleteList.push(`${subtask.id} ${subtask.title}`);
        }
      }
      
      console.log(`  📊 Subtasks: ${subtaskCompleted}/${subtaskTotal} completed\n`);
    } else {
      console.log('');
    }
  }
  
  // Summary
  console.log('📊 SUMMARY');
  console.log('==========');
  console.log(`Total Tasks: ${totalTasks}`);
  console.log(`Completed: ${completedTasks} ✅`);
  console.log(`Incomplete: ${incompleteTasks} ❌`);
  console.log(`Completion Rate: ${((completedTasks / totalTasks) * 100).toFixed(1)}%\n`);
  
  // Incomplete tasks
  if (incompleteList.length > 0) {
    console.log('❌ INCOMPLETE TASKS:');
    console.log('===================');
    incompleteList.forEach((task, index) => {
      console.log(`${index + 1}. ${task}`);
    });
    console.log('');
  }
  
  // Final status
  if (incompleteTasks === 0) {
    console.log('🎉 ALL TASKS COMPLETED!');
    console.log('✅ Phase 1 is 100% complete');
    console.log('✅ Ready to proceed to Phase 2');
  } else {
    console.log('⚠️  SOME TASKS ARE INCOMPLETE');
    console.log(`❌ ${incompleteTasks} tasks need attention`);
    console.log('❌ Phase 1 is not fully complete');
  }
}

function checkSpecificTasks(tasks: TaskItem[]): void {
  console.log('\n🎯 SPECIFIC TASK VERIFICATION');
  console.log('=============================\n');
  
  const criticalTasks = [
    '1', '2', '3', '4', '5', '6', '7', '8', '9',
    '1.1', '1.2', '1.3', '1.4',
    '2.1', '2.2', '2.3',
    '3.1', '3.2', '3.3', '3.4',
    '4.1', '4.2', '4.3', '4.4',
    '5.1', '5.2', '5.3',
    '6.1', '6.2', '6.3', '6.4',
    '7.1', '7.2', '7.3',
    '8.1', '8.2', '8.3', '8.4',
    '9.1', '9.2', '9.3'
  ];
  
  const allTasksFlat: TaskItem[] = [];
  
  // Flatten all tasks
  for (const task of tasks) {
    allTasksFlat.push(task);
    allTasksFlat.push(...task.subtasks);
  }
  
  let foundTasks = 0;
  let completedCritical = 0;
  
  for (const criticalId of criticalTasks) {
    const found = allTasksFlat.find(t => t.id === criticalId);
    
    if (found) {
      foundTasks++;
      const status = found.status === 'completed' ? '✅' : '❌';
      const statusText = found.status === 'completed' ? 'COMPLETE' : 'INCOMPLETE';
      
      console.log(`${status} Task ${found.id}: ${statusText}`);
      
      if (found.status === 'completed') {
        completedCritical++;
      }
    } else {
      console.log(`❓ Task ${criticalId}: NOT FOUND`);
    }
  }
  
  console.log(`\n📊 Critical Tasks: ${completedCritical}/${criticalTasks.length} completed`);
  console.log(`📊 Found Tasks: ${foundTasks}/${criticalTasks.length}`);
  
  if (completedCritical === criticalTasks.length) {
    console.log('✅ All critical tasks are completed!');
  } else {
    console.log(`❌ ${criticalTasks.length - completedCritical} critical tasks are incomplete`);
  }
}

async function checkDeliverables(): Promise<void> {
  console.log('\n📋 DELIVERABLES CHECK');
  console.log('====================\n');
  
  const expectedDeliverables = [
    { path: 'docs/phase1/final-validation-report.md', name: 'Final Validation Report' },
    { path: 'docs/phase1/technical-documentation.md', name: 'Technical Documentation' },
    { path: 'docs/phase1/troubleshooting-guide.md', name: 'Troubleshooting Guide' },
    { path: 'docs/phase1/phase1-completion-report.md', name: 'Phase 1 Completion Report' },
    { path: 'docs/phase1/phase2-readiness-documentation.md', name: 'Phase 2 Readiness Documentation' },
    { path: 'docs/phase1/field-mapping-analysis.md', name: 'Field Mapping Analysis' },
    { path: 'docs/phase1/integration-test-validation.md', name: 'Integration Test Validation' },
    { path: 'src/lib/__tests__/end-to-end-integration.test.ts', name: 'End-to-End Integration Tests' },
    { path: 'src/lib/__tests__/performance-integration.test.ts', name: 'Performance Integration Tests' },
    { path: 'scripts/validate-integration-tests.ts', name: 'Integration Test Validator' }
  ];
  
  let foundDeliverables = 0;
  
  for (const deliverable of expectedDeliverables) {
    try {
      await fs.access(deliverable.path);
      console.log(`✅ ${deliverable.name}: Found`);
      foundDeliverables++;
    } catch {
      console.log(`❌ ${deliverable.name}: Missing (${deliverable.path})`);
    }
  }
  
  console.log(`\n📊 Deliverables: ${foundDeliverables}/${expectedDeliverables.length} found`);
  
  if (foundDeliverables === expectedDeliverables.length) {
    console.log('✅ All deliverables are present!');
  } else {
    console.log(`❌ ${expectedDeliverables.length - foundDeliverables} deliverables are missing`);
  }
}

async function main(): Promise<void> {
  try {
    console.log('🚀 SyncStore Phase 1 - Task Completion Checker');
    console.log('===============================================\n');
    
    // Parse and check tasks
    const tasks = await parseTaskList();
    generateTaskReport(tasks);
    
    // Check specific critical tasks
    checkSpecificTasks(tasks);
    
    // Check deliverables
    await checkDeliverables();
    
    console.log('\n🏁 CHECK COMPLETE');
    console.log('=================');
    console.log('Review the results above to ensure all tasks are completed.');
    
  } catch (error) {
    console.error('❌ Error during task check:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);