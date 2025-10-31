// components/QuestionEditor.tsx
'use client';

import { Question, QuestionType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Trash2, GripVertical } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // We need RadioGroup

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
    value: string
  ) => {
    onQuestionChange(index, { ...question, [field]: value });
  };

  // Handler for question type change
  const handleTypeChange = (value: QuestionType) => {
    const newQuestion: Question = { ...question, question_type: value };
    // Reset options/answers when type changes
    if (value === 'MULTIPLE_CHOICE') {
      newQuestion.options = ["Option 1", "Option 2", "Option 3", "Option 4"];
      newQuestion.correct_answer = "Option 1";
    } else if (value === 'TRUE_FALSE') {
      newQuestion.options = ["True", "False"];
      newQuestion.correct_answer = "True";
    } else if (value === 'FILL_IN_THE_BLANK') {
      newQuestion.options = null;
      newQuestion.correct_answer = "Answer";
    }
    onQuestionChange(index, newQuestion);
  };

  // Handler for multiple-choice option text
  const handleOptionChange = (optionIndex: number, value: string) => {
    const newOptions = [...(Array.isArray(question.options) ? question.options : [])];
    newOptions[optionIndex] = value;
    
    // If the changed option was the correct answer, update the correct answer string as well
    const newCorrectAnswer =
      question.correct_answer === question.options[optionIndex]
        ? value
        : question.correct_answer;

    onQuestionChange(index, { 
      ...question, 
      options: newOptions,
      correct_answer: newCorrectAnswer
    });
  };

  // Handler for changing the *correct* multiple-choice option
  const handleCorrectAnswerChange = (value: string) => {
    onQuestionChange(index, { ...question, correct_answer: value });
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

        {/* Answer Fields based on Type */}
        {question.question_type === 'MULTIPLE_CHOICE' && (
          <div className="space-y-3">
            <Label>Options & Correct Answer</Label>
            <RadioGroup
              value={question.correct_answer}
              onValueChange={handleCorrectAnswerChange}
              className="space-y-2"
            >
              {Array.isArray(question.options) && question.options.map((option, optIndex) => (
                <div key={optIndex} className="flex items-center gap-2">
                  <RadioGroupItem
                    value={option}
                    id={`q-${index}-opt-${optIndex}`}
                  />
                  <Input
                    value={option}
                    onChange={(e) => handleOptionChange(optIndex, e.target.value)}
                    placeholder={`Option ${optIndex + 1}`}
                  />
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

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

        {question.question_type === 'FILL_IN_THE_BLANK' && (
          <div className="space-y-2">
            <Label htmlFor={`q-${index}-answer`}>Correct Answer</Label>
            <Input
              id={`q-${index}-answer`}
              value={question.correct_answer}
              onChange={(e) => handleChange('correct_answer', e.target.value)}
              placeholder="Enter the exact answer"
            />
             <p className="text-xs text-muted-foreground">
              Tip: Use "____" in the question text to show where the blank is.
            </p>
          </div>
        )}
        
        {/* Explanation Field */}
        <div className="space-y-2">
          <Label htmlFor={`q-${index}-explanation`}>Explanation (Optional)</Label>
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

// We need to add RadioGroup to the UI components
// If you don't have `components/ui/radio-group.tsx`, create it with:
// npx shadcn-ui@latest add radio-group
// Or, if you can't run that, let me know and I'll provide the code.