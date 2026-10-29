import os
from dataclasses import dataclass
from typing import Dict
from dotenv import load_dotenv

# Load local environment variables if available
load_dotenv()

# Fixed default random seed for full determinism and reproducibility
SEED: int = 20261022

# Default scale factor
DEFAULT_SCALE: float = 1.0

# Baseline volumes (at scale = 1.0)
BASELINE_VOLUMES: Dict[str, int] = {
    "requesters": 300,
    "suppliers": 120,
    "requests": 1200,
    "rfqs": 500,
    "quotes": 1500,
    "pos": 900
}

@dataclass
class GeneratorConfig:
    seed: int
    scale: float
    volumes: Dict[str, int]
    output_dir: str

def get_config(scale: float = DEFAULT_SCALE, seed: int = SEED, output_dir: str = "output") -> GeneratorConfig:
    """
    Computes scaled entity volumes based on baseline configuration and scale factor.
    Guarantees at least 1 record per entity if scale > 0.
    """
    scaled_volumes: Dict[str, int] = {}
    for entity, base_count in BASELINE_VOLUMES.items():
        computed = int(round(base_count * scale))
        scaled_volumes[entity] = max(1, computed) if scale > 0 else 0

    return GeneratorConfig(
        seed=seed,
        scale=scale,
        volumes=scaled_volumes,
        output_dir=output_dir
    )
