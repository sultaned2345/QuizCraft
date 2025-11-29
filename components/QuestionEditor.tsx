// components/QuestionEditor.tsx
'use client';

import { Question, QuestionType } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Trash2,
  GripVertical,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

interface QuestionEditorProps {
  question: Question;
  index: number;
  onQuestionChange: (index: number, updatedQuestion: Question) => void;
  onRemoveQuestion: (index: number) => void;
}

export function QuestionEditor({
  question,
  index,
  onQuestionChange,
  onRemoveQuestion,
}: QuestionEditorProps) {
  // Generic handler for any text-based field
  const handleChange = (
    field: keyof Question,
    value: string | string[] | null
  ) => {
    onQuestionChange(index, { ...question, [field]: value });
  };

  // Handler for question type change
  const handleTypeChange = (value: QuestionType) => {
    const newQuestion: Question = { ...question, question_type: value };
    
    // Reset defaults based on type
    if (value === 'MULTIPLE_CHOICE') {
      newQuestion.options = ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
      newQuestion.prompts = null;
      newQuestion.correct_answer = 'Option 1';
    } else if (value === 'TRUE_FALSE') {
      newQuestion.options = ['True', 'False'];
      newQuestion.prompts = null;
      newQuestion.correct_answer = 'True';
    } else if (value === 'FILL_IN_THE_BLANK') {
      newQuestion.options = ['Answer'];
      newQuestion.prompts = null;
      newQuestion.correct_answer = 'N/A';
    } else if (value === 'MATCHING') {
      newQuestion.prompts = ['Prompt 1'];
      newQuestion.options = ['Answer 1']; // Corresponds to Prompt 1
      newQuestion.correct_answer = 'N/A';
    } else if (value === 'ORDERING') {
      newQuestion.options = ['Step 1', 'Step 2', 'Step 3']; // Defined in correct order
      newQuestion.prompts = null;
      newQuestion.correct_answer = 'N/A';
    }
    
    onQuestionChange(index, newQuestion);
  };

  // Handler for option text changes (MC, Ordering, Matching answers)
  const handleOptionChange = (optionIndex: number, value: string) => {
    const newOptions = [
      ...(Array.isArray(question.options) ? question.options : []),
    ];
    const oldOptionValue = newOptions[optionIndex];
    newOptions[optionIndex] = value;

    // For Multiple Choice, if we renamed the correct option, update correct_answer too
    let newCorrectAnswer = question.correct_answer;
    if (
      question.question_type === 'MULTIPLE_CHOICE' &&
      question.correct_answer === oldOptionValue
    ) {
      newCorrectAnswer = value;
    }

    onQuestionChange(index, {
      ...question,
      options: newOptions,
      correct_answer: newCorrectAnswer,
    });
  };

  // Handler for selecting the correct answer (MC, TF)
  const handleCorrectAnswerChange = (value: string) => {
    onQuestionChange(index, { ...question, correct_answer: value });
  };

  // Handler for Fill-in-the-Blank (comma-separated)
  const handleFillInTheBlankChange = (value: string) => {
    const answers = value.split(',').map((s) => s.trim()).filter(Boolean);
    handleChange('options', answers);
  };

  // --- MATCHING Handlers ---
  const handleMatchingChange = (
    type: 'prompt' | 'option',
    pairIndex: number,
    value: string
  ) => {
    const newPrompts = [
      ...(Array.isArray(question.prompts) ? question.prompts : []),
    ];
    const newOptions = [
      ...(Array.isArray(question.options) ? question.options : []),
    ];

    if (type === 'prompt') {
      newPrompts[pairIndex] = value;
    } else {
      newOptions[pairIndex] = value;
    }

    onQuestionChange(index, {
      ...question,
      prompts: newPrompts,
      options: newOptions,
    });
  };

  const addMatchingPair = () => {
    const newPrompts = [
      ...(Array.isArray(question.prompts) ? question.prompts : []),
      `Prompt ${question.prompts ? question.prompts.length + 1 : 1}`,
    ];
    const newOptions = [
      ...(Array.isArray(question.options) ? question.options : []),
      `Answer ${question.options ? question.options.length + 1 : 1}`,
    ];
    onQuestionChange(index, {
      ...question,
      prompts: newPrompts,
      options: newOptions,
    });
  };

  const removeMatchingPair = (pairIndex: number) => {
    const newPrompts = [
      ...(Array.isArray(question.prompts) ? question.prompts : []),
    ];
    const newOptions = [
      ...(Array.isArray(question.options) ? question.options : []),
    ];
    
    // Remove both to keep indices aligned
    newPrompts.splice(pairIndex, 1);
    newOptions.splice(pairIndex, 1);
    
    onQuestionChange(index, {
      ...question,
      prompts: newPrompts,
      options: newOptions,
    });
  };

  // --- ORDERING Handlers ---
  const addOrderingItem = () => {
    const newOptions = [
      ...(Array.isArray(question.options) ? question.options : []),
      `Step ${question.options ? question.options.length + 1 : 1}`,
    ];
    onQuestionChange(index, { ...question, options: newOptions });
  };

  const removeOrderingItem = (idx: number) => {
    const newOptions = [
      ...(Array.isArray(question.options) ? question.options : []),
    ];
    newOptions.splice(idx, 1);
    onQuestionChange(index, { ...question, options: newOptions });
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute left-2 top-2 text-muted-foreground cursor-grab">
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="absolute right-2 top-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive h-8 w-8"
          onClick={() => onRemoveQuestion(index)}
        >
          <Trash2 className="w-4 h-4" />
          <span className="sr-only">Remove Question</span>
        </Button>
      </div>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Label className="text-lg font-semibold">Q{index + 1}</Label>
          <Select
            value={question.question_type}
            onValueChange={(value: QuestionType) => handleTypeChange(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MULTIPLE_CHOICE">Multiple Choice</SelectItem>
              <SelectItem value="TRUE_FALSE">True/False</SelectItem>
              <SelectItem value="FILL_IN_THE_BLANK">Fill in the Blank</SelectItem>
              <SelectItem value="MATCHING">Matching</SelectItem>
              <SelectItem value="ORDERING">Ordering</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Question Text */}
        <div className="space-y-2">
          <Label htmlFor={`q-${index}-text`}>Question Text</Label>
          <Textarea
            id={`q-${index}-text`}
            value={question.question_text}
            onChange={(e) => handleChange('question_text', e.target.value)}
            placeholder="e.g., What is the capital of France?"
          />
        </div>

        {/* --- MULTIPLE CHOICE --- */}
        {question.question_type === 'MULTIPLE_CHOICE' && (
          <div className="space-y-3">
            <Label>Options & Correct Answer</Label>
            <RadioGroup
              value={question.correct_answer}
              onValueChange={handleCorrectAnswerChange}
              className="space-y-2"
            >
              {Array.isArray(question.options) &&
                question.options.map((option, optIndex) => (
                  <div key={optIndex} className="flex items-center gap-2">
                    <RadioGroupItem
                      value={option}
                      id={`q-${index}-opt-${optIndex}`}
                    />
                    <Input
                      value={option}
                      onChange={(e) =>
                        handleOptionChange(optIndex, e.target.value)
                      }
                      placeholder={`Option ${optIndex + 1}`}
                    />
                  </div>
                ))}
            </RadioGroup>
          </div>
        )}

        {/* --- TRUE / FALSE --- */}
        {question.question_type === 'TRUE_FALSE' && (
          <div className="space-y-2">
            <Label>Correct Answer</Label>
            <RadioGroup
              value={question.correct_answer}
              onValueChange={handleCorrectAnswerChange}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="True" id={`q-${index}-true`} />
                <Label htmlFor={`q-${index}-true`}>True</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="False" id={`q-${index}-false`} />
                <Label htmlFor={`q-${index}-false`}>False</Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* --- FILL IN THE BLANK --- */}
        {question.question_type === 'FILL_IN_THE_BLANK' && (
          <div className="space-y-2">
            <Label htmlFor={`q-${index}-answer`}>
              Correct Answers (comma-separated)
            </Label>
            <Input
              id={`q-${index}-answer`}
              value={
                Array.isArray(question.options)
                  ? question.options.join(', ')
                  : ''
              }
              onChange={(e) => handleFillInTheBlankChange(e.target.value)}
              placeholder="Enter one or more acceptable answers (e.g. Color, Colour)"
            />
            <p className="text-xs text-muted-foreground">
              Tip: Use "____" in the question text. Grading is case-insensitive.
            </p>
          </div>
        )}

        {/* --- MATCHING --- */}
        {question.question_type === 'MATCHING' && (
          <div className="space-y-3">
            <Label>Matching Pairs (Prompt &rarr; Correct Answer)</Label>
            <div className="space-y-2">
              {Array.isArray(question.prompts) &&
                question.prompts.map((prompt, pairIndex) => (
                  <div key={pairIndex} className="flex items-center gap-2">
                    <Input
                      value={prompt}
                      onChange={(e) =>
                        handleMatchingChange('prompt', pairIndex, e.target.value)
                      }
                      placeholder={`Prompt ${pairIndex + 1}`}
                      className="flex-1"
                    />
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Input
                      value={
                        (Array.isArray(question.options) &&
                          question.options[pairIndex]) ||
                        ''
                      }
                      onChange={(e) =>
                        handleMatchingChange('option', pairIndex, e.target.value)
                      }
                      placeholder={`Answer ${pairIndex + 1}`}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-9 w-9 shrink-0',
                        question.prompts.length > 1
                          ? 'text-destructive'
                          : 'text-muted-foreground opacity-50 cursor-not-allowed'
                      )}
                      onClick={() => removeMatchingPair(pairIndex)}
                      disabled={
                        !question.prompts || question.prompts.length <= 1
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addMatchingPair}
              className="mt-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Pair
            </Button>
          </div>
        )}

        {/* --- ORDERING (NEW) --- */}
        {question.question_type === 'ORDERING' && (
          <div className="space-y-3">
            <Label>Correct Sequence (Item 1 is First, Item N is Last)</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Enter the steps in the correct logical order. The system will
              automatically shuffle them for the user.
            </p>
            <div className="space-y-2">
              {Array.isArray(question.options) &&
                question.options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-8 h-8 flex items-center justify-center bg-muted rounded-full text-xs font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <Input
                      value={option}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`Step ${idx + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-destructive"
                      onClick={() => removeOrderingItem(idx)}
                      disabled={
                        !question.options || question.options.length <= 2
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addOrderingItem}
              className="mt-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Step
            </Button>
          </div>
        )}

        {/* Explanation Field */}
        <div className="space-y-2">
          <Label htmlFor={`q-${index}-explanation`}>
            Explanation (Optional)
          </Label>
          <Input
            id={`q-${index}-explanation`}
            value={question.explanation || ''}
            onChange={(e) => handleChange('explanation', e.target.value)}
            placeholder="Why is this the correct answer?"
          />
        </div>
      </CardContent>
    </Card>
  );
}