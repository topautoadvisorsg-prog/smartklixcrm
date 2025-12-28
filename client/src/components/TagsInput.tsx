import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Plus, Tag as TagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { queryClient } from "@/lib/queryClient";
import type { Tag } from "@shared/schema";

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function TagsInput({ value, onChange, placeholder = "Add tag...", className = "" }: TagsInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { data: allTags = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
  });

  const createTagMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: getRandomColor() }),
      });
      if (!response.ok) throw new Error("Failed to create tag");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
    },
  });

  const getRandomColor = () => {
    const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899"];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handleAddTag = async (tagName: string) => {
    if (!tagName.trim()) return;
    
    const normalizedName = tagName.trim().toLowerCase();
    if (value.includes(normalizedName)) return;

    const existingTag = allTags.find(t => t.name.toLowerCase() === normalizedName);
    if (!existingTag) {
      await createTagMutation.mutateAsync(normalizedName);
    }
    
    onChange([...value, normalizedName]);
    setInputValue("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(value.filter(t => t !== tagToRemove));
  };

  const getTagColor = (tagName: string) => {
    const tag = allTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    return tag?.color || "#6b7280";
  };

  const filteredSuggestions = allTags
    .filter(t => 
      t.name.toLowerCase().includes(inputValue.toLowerCase()) && 
      !value.includes(t.name.toLowerCase())
    )
    .slice(0, 5);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-1">
        {value.map(tag => (
          <Badge 
            key={tag} 
            variant="secondary"
            className="gap-1 pr-1"
            style={{ backgroundColor: `${getTagColor(tag)}20`, borderColor: getTagColor(tag) }}
            data-testid={`tag-badge-${tag}`}
          >
            <TagIcon className="w-3 h-3" style={{ color: getTagColor(tag) }} />
            <span>{tag}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={() => handleRemoveTag(tag)}
              data-testid={`button-remove-tag-${tag}`}
            >
              <X className="w-3 h-3" />
            </Button>
          </Badge>
        ))}
      </div>
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              placeholder={placeholder}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (!isOpen && e.target.value) setIsOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag(inputValue);
                }
              }}
              onFocus={() => inputValue && setIsOpen(true)}
              className="pr-10"
              data-testid="input-tag"
            />
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => handleAddTag(inputValue)}
              disabled={!inputValue.trim()}
              data-testid="button-add-tag"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </PopoverTrigger>
        {filteredSuggestions.length > 0 && (
          <PopoverContent className="w-[200px] p-1" align="start">
            <div className="space-y-1">
              {filteredSuggestions.map(tag => (
                <button
                  key={tag.id}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                  onClick={() => {
                    onChange([...value, tag.name.toLowerCase()]);
                    setInputValue("");
                    setIsOpen(false);
                  }}
                  data-testid={`tag-suggestion-${tag.name}`}
                >
                  <TagIcon className="w-3 h-3" style={{ color: tag.color || "#6b7280" }} />
                  <span>{tag.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}
