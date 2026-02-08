/**
 * Vue composable equivalent of OpenCut's use-action-handler.ts
 * Binds an action handler to the global action system.
 */
import { watch, onUnmounted, type Ref } from "vue";
import type {
	TAction,
	TActionFunc,
	TArgOfAction,
	TInvocationTrigger,
} from "../../lib/actions/types";
import { bindAction, unbindAction } from "../../lib/actions";

export function useActionHandler<A extends TAction>(
	action: A,
	handler: TActionFunc<A>,
	isActive?: Ref<boolean> | boolean | undefined,
) {
	let isBound = false;

	// Create a stable wrapper that always calls the latest handler
	const stableHandler = ((...parameters: [TArgOfAction<A>, TInvocationTrigger?]) => {
		(handler as (...args: [TArgOfAction<A>, TInvocationTrigger?]) => void)(...parameters);
	}) as TActionFunc<A>;

	function bind() {
		if (!isBound) {
			bindAction(action, stableHandler);
			isBound = true;
		}
	}

	function unbind() {
		if (isBound) {
			unbindAction(action, stableHandler);
			isBound = false;
		}
	}

	if (isActive === undefined || isActive === true) {
		bind();
	} else if (typeof isActive === "object" && "value" in isActive) {
		// It's a Ref<boolean>
		watch(
			isActive,
			(active) => {
				if (active) bind();
				else unbind();
			},
			{ immediate: true },
		);
	}

	onUnmounted(unbind);
}
