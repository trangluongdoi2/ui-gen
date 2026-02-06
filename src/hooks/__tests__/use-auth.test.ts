import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import * as actions from "@/actions";
import * as anonWorkTracker from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockPush = vi.fn();
const mockUseRouter = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => mockUseRouter(),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("signIn", () => {
    it("should handle successful sign-in with anonymous work", async () => {
      const mockAnonWork = {
        messages: [{ role: "user", content: "test message" }],
        fileSystemData: { "/": { type: "directory" } },
      };
      const mockProject = { id: "project-123", name: "Design from 10:30:00 AM" };

      vi.mocked(actions.signIn).mockResolvedValue({ success: true });
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(mockAnonWork);
      vi.mocked(createProject).mockResolvedValue(mockProject as any);

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      let authResult: any;
      await act(async () => {
        authResult = await result.current.signIn("test@example.com", "password123");
      });

      expect(authResult).toEqual({ success: true });
      expect(actions.signIn).toHaveBeenCalledWith("test@example.com", "password123");
      expect(anonWorkTracker.getAnonWorkData).toHaveBeenCalled();
      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: mockAnonWork.messages,
        data: mockAnonWork.fileSystemData,
      });
      expect(anonWorkTracker.clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/project-123");
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle successful sign-in with existing projects", async () => {
      const mockProjects = [
        { id: "project-1", name: "Project 1" },
        { id: "project-2", name: "Project 2" },
      ];

      vi.mocked(actions.signIn).mockResolvedValue({ success: true });
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue(mockProjects as any);

      const { result } = renderHook(() => useAuth());

      const authResult = await result.current.signIn("test@example.com", "password123");

      expect(authResult).toEqual({ success: true });
      expect(getProjects).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/project-1");
      expect(createProject).not.toHaveBeenCalled();
    });

    it("should handle successful sign-in with no anonymous work and empty messages", async () => {
      const mockAnonWork = {
        messages: [],
        fileSystemData: { "/": { type: "directory" } },
      };
      const mockProjects = [{ id: "project-1", name: "Project 1" }];

      vi.mocked(actions.signIn).mockResolvedValue({ success: true });
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(mockAnonWork);
      vi.mocked(getProjects).mockResolvedValue(mockProjects as any);

      const { result } = renderHook(() => useAuth());

      await result.current.signIn("test@example.com", "password123");

      expect(createProject).not.toHaveBeenCalled();
      expect(getProjects).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/project-1");
    });

    it("should create new project when user has no existing projects", async () => {
      const mockProject = { id: "new-project-123", name: "New Design #12345" };

      vi.mocked(actions.signIn).mockResolvedValue({ success: true });
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue(mockProject as any);

      const { result } = renderHook(() => useAuth());

      await result.current.signIn("test@example.com", "password123");

      expect(getProjects).toHaveBeenCalled();
      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+$/),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith("/new-project-123");
    });

    it("should handle failed sign-in", async () => {
      const errorResult = { success: false, error: "Invalid credentials" };

      vi.mocked(actions.signIn).mockResolvedValue(errorResult);

      const { result } = renderHook(() => useAuth());

      const authResult = await result.current.signIn("test@example.com", "wrongpassword");

      expect(authResult).toEqual(errorResult);
      expect(anonWorkTracker.getAnonWorkData).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    it("should set loading state to false even if sign-in throws error", async () => {
      vi.mocked(actions.signIn).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        result.current.signIn("test@example.com", "password123")
      ).rejects.toThrow("Network error");

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signUp", () => {
    it("should handle successful sign-up with anonymous work", async () => {
      const mockAnonWork = {
        messages: [{ role: "user", content: "create a button" }],
        fileSystemData: { "/": { type: "directory" }, "/Button.tsx": { type: "file" } },
      };
      const mockProject = { id: "new-project-456", name: "Design from 2:30:00 PM" };

      vi.mocked(actions.signUp).mockResolvedValue({ success: true });
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(mockAnonWork);
      vi.mocked(createProject).mockResolvedValue(mockProject as any);

      const { result } = renderHook(() => useAuth());

      const authResult = await result.current.signUp("newuser@example.com", "password123");

      expect(authResult).toEqual({ success: true });
      expect(actions.signUp).toHaveBeenCalledWith("newuser@example.com", "password123");
      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: mockAnonWork.messages,
        data: mockAnonWork.fileSystemData,
      });
      expect(anonWorkTracker.clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/new-project-456");
    });

    it("should handle successful sign-up without anonymous work", async () => {
      const mockProject = { id: "first-project", name: "New Design #98765" };

      vi.mocked(actions.signUp).mockResolvedValue({ success: true });
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue(mockProject as any);

      const { result } = renderHook(() => useAuth());

      await result.current.signUp("newuser@example.com", "password123");

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+$/),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith("/first-project");
    });

    it("should handle failed sign-up", async () => {
      const errorResult = { success: false, error: "Email already registered" };

      vi.mocked(actions.signUp).mockResolvedValue(errorResult);

      const { result } = renderHook(() => useAuth());

      const authResult = await result.current.signUp("existing@example.com", "password123");

      expect(authResult).toEqual(errorResult);
      expect(anonWorkTracker.getAnonWorkData).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    it("should set loading state to false even if sign-up throws error", async () => {
      vi.mocked(actions.signUp).mockRejectedValue(new Error("Database error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        result.current.signUp("test@example.com", "password123")
      ).rejects.toThrow("Database error");

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("isLoading state", () => {
    it("should initialize with isLoading as false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    it("should set isLoading to true during sign-in", async () => {
      let resolveSignIn: any;
      const signInPromise = new Promise<any>((resolve) => {
        resolveSignIn = resolve;
      });

      vi.mocked(actions.signIn).mockReturnValue(signInPromise);
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({ id: "test", name: "Test" } as any);

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      let authPromise: Promise<any>;
      act(() => {
        authPromise = result.current.signIn("test@example.com", "password123");
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        resolveSignIn({ success: true });
        await authPromise!;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("should set isLoading to true during sign-up", async () => {
      let resolveSignUp: any;
      const signUpPromise = new Promise<any>((resolve) => {
        resolveSignUp = resolve;
      });

      vi.mocked(actions.signUp).mockReturnValue(signUpPromise);
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({ id: "test", name: "Test" } as any);

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      let authPromise: Promise<any>;
      act(() => {
        authPromise = result.current.signUp("test@example.com", "password123");
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        resolveSignUp({ success: true });
        await authPromise!;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle getProjects throwing an error after successful sign-in", async () => {
      vi.mocked(actions.signIn).mockResolvedValue({ success: true });
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockRejectedValue(new Error("Database connection failed"));

      const { result } = renderHook(() => useAuth());

      await expect(
        result.current.signIn("test@example.com", "password123")
      ).rejects.toThrow("Database connection failed");

      expect(result.current.isLoading).toBe(false);
    });

    it("should handle createProject throwing an error after successful sign-in", async () => {
      vi.mocked(actions.signIn).mockResolvedValue({ success: true });
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockRejectedValue(new Error("Failed to create project"));

      const { result } = renderHook(() => useAuth());

      await expect(
        result.current.signIn("test@example.com", "password123")
      ).rejects.toThrow("Failed to create project");

      expect(result.current.isLoading).toBe(false);
    });

    it("should handle createProject throwing an error when migrating anonymous work", async () => {
      const mockAnonWork = {
        messages: [{ role: "user", content: "test" }],
        fileSystemData: {},
      };

      vi.mocked(actions.signUp).mockResolvedValue({ success: true });
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(mockAnonWork);
      vi.mocked(createProject).mockRejectedValue(new Error("Database error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        result.current.signUp("test@example.com", "password123")
      ).rejects.toThrow("Database error");

      expect(anonWorkTracker.clearAnonWork).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    it("should prioritize anonymous work over existing projects", async () => {
      const mockAnonWork = {
        messages: [{ role: "user", content: "important work" }],
        fileSystemData: {},
      };
      const mockNewProject = { id: "anon-project", name: "Design from 3:00:00 PM" };
      const mockExistingProjects = [{ id: "existing-project", name: "Existing" }];

      vi.mocked(actions.signIn).mockResolvedValue({ success: true });
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(mockAnonWork);
      vi.mocked(createProject).mockResolvedValue(mockNewProject as any);
      vi.mocked(getProjects).mockResolvedValue(mockExistingProjects as any);

      const { result } = renderHook(() => useAuth());

      await result.current.signIn("test@example.com", "password123");

      expect(createProject).toHaveBeenCalled();
      expect(getProjects).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-project");
    });

    it("should generate unique project names using random numbers", async () => {
      vi.mocked(actions.signIn).mockResolvedValue({ success: true });
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({ id: "id", name: "Test" } as any);

      const { result } = renderHook(() => useAuth());

      await result.current.signIn("test@example.com", "password123");

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringMatching(/^New Design #\d{1,5}$/),
        })
      );
    });
  });

  describe("return value", () => {
    it("should return signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current).toHaveProperty("signIn");
      expect(result.current).toHaveProperty("signUp");
      expect(result.current).toHaveProperty("isLoading");
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });
});
