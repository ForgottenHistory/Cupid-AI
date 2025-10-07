import requests
import json
import base64
from PIL import Image
from io import BytesIO
import os
from typing import Optional, Dict, Any, List

class StableDiffusionHiRes:
    def __init__(self, base_url: str = "http://127.0.0.1:7860"):
        """
        Initialize the Stable Diffusion High Resolution client
        
        Args:
            base_url: Base URL of the Stable Diffusion WebUI API
        """
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        
    def generate_hires_image(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 832,
        height: int = 1216,
        hr_scale: float = 1.5,
        hr_upscaler: str = "remacri_original",
        steps: int = 30,
        hr_second_pass_steps: int = 15,
        cfg_scale: float = 7.0,
        hr_cfg: float = 5.0,
        sampler_name: str = "DPM++ 2M",
        scheduler: str = "Karras",
        seed: int = -1,
        batch_size: int = 1,
        save_images: bool = True,
        output_dir: str = "output",
        denoising_strength: float = 0.7,
        use_adetailer: bool = True,
        adetailer_models: List[str] = None
    ) -> Dict[str, Any]:
        """
        Generate high resolution images using txt2img with hires fix and ADetailer
        
        Args:
            prompt: Text prompt for image generation
            negative_prompt: Negative prompt
            width: Initial width (first pass)
            height: Initial height (first pass)
            hr_scale: High resolution scale factor
            hr_upscaler: Upscaler model name
            steps: Number of sampling steps for first pass
            hr_second_pass_steps: Number of steps for high-res pass
            cfg_scale: CFG scale for first pass
            hr_cfg: CFG scale for high-res pass
            sampler_name: Sampler to use
            scheduler: Scheduler to use
            seed: Random seed (-1 for random)
            batch_size: Number of images to generate
            save_images: Whether to save images to disk
            output_dir: Directory to save images
            denoising_strength: Denoising strength for high-res pass
            use_adetailer: Whether to use ADetailer
            adetailer_models: List of ADetailer models to use
            
        Returns:
            Dictionary containing the API response
        """
        
        if adetailer_models is None:
            adetailer_models = ["face_yolov8n.pt"]
        
        # Prepare the request payload
        payload = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "width": width,
            "height": height,
            "steps": steps,
            "cfg_scale": cfg_scale,
            "sampler_name": sampler_name,
            "scheduler": scheduler,
            "seed": seed,
            "batch_size": batch_size,
            "n_iter": 1,
            
            # High-res fix settings
            "enable_hr": True,
            "hr_scale": hr_scale,
            "hr_upscaler": hr_upscaler,
            "hr_second_pass_steps": hr_second_pass_steps,
            "hr_cfg": hr_cfg,
            "hr_additional_modules": ["Use same choices"],
            "denoising_strength": denoising_strength,
            
            # Final resolution
            "hr_resize_x": int(width * hr_scale),
            "hr_resize_y": int(height * hr_scale),
            
            "send_images": True,
            "save_images": False,
        }
        
        # Add ADetailer configuration if enabled
        if use_adetailer:
            adetailer_args = [
                True,  # Enable ADetailer
                False,  # Skip image generation if no detection
            ]
            
            # Configure first model
            adetailer_args.append({
                "ad_model": adetailer_models[0],
                "ad_prompt": "",
                "ad_negative_prompt": "",
                "ad_confidence": 0.3,
                "ad_mask_k_largest": 0,
                "ad_mask_min_ratio": 0.0,
                "ad_mask_max_ratio": 1.0,
                "ad_dilate_erode": 4,
                "ad_x_offset": 0,
                "ad_y_offset": 0,
                "ad_mask_merge_invert": "None",
                "ad_mask_blur": 4,
                "ad_denoising_strength": 0.4,
                "ad_inpaint_only_masked": True,
                "ad_inpaint_only_masked_padding": 32,
                "ad_use_inpaint_width_height": False,
                "ad_inpaint_width": 832,
                "ad_inpaint_height": 1216,
                "ad_use_steps": False,
                "ad_steps": 28,
                "ad_use_cfg_scale": False,
                "ad_cfg_scale": 7.0,
                "ad_use_sampler": False,
                "ad_sampler": "DPM++ 2M",
                "ad_use_noise_multiplier": False,
                "ad_noise_multiplier": 1.0,
                "ad_use_clip_skip": False,
                "ad_clip_skip": 1,
                "ad_restore_face": False,
                "ad_controlnet_model": "None",
                "ad_controlnet_module": "None",
                "ad_controlnet_weight": 1.0,
                "ad_controlnet_guidance_start": 0.0,
                "ad_controlnet_guidance_end": 1.0,
            })
            
            # Add additional models if specified (up to 3 total)
            for i, model in enumerate(adetailer_models[1:], 1):
                if i >= 3:
                    break
                adetailer_args.append({
                    "ad_model": model,
                    "ad_prompt": "",
                    "ad_negative_prompt": "",
                    "ad_confidence": 0.3,
                    "ad_mask_blur": 4,
                    "ad_denoising_strength": 0.4,
                    "ad_inpaint_only_masked": True,
                    "ad_inpaint_only_masked_padding": 32,
                    "ad_use_inpaint_width_height": False,
                    "ad_use_steps": False,
                    "ad_use_cfg_scale": False,
                    "ad_use_sampler": False,
                    "ad_restore_face": False,
                })
            
            payload["alwayson_scripts"] = {
                "ADetailer": {
                    "args": adetailer_args
                }
            }
        
        try:
            # Make the API request
            response = self.session.post(
                f"{self.base_url}/sdapi/v1/txt2img",
                json=payload,
                timeout=300
            )
            response.raise_for_status()
            
            result = response.json()
            
            # Save images if requested
            if save_images and result.get('images'):
                saved_paths = self._save_images(result['images'], output_dir, prompt[:50])
                result['saved_paths'] = saved_paths
                
            return result
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"API request failed: {e}")
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse API response: {e}")
    
    def _save_images(self, base64_images: list, output_dir: str, prompt_prefix: str) -> list:
        """
        Save base64 encoded images to disk
        
        Args:
            base64_images: List of base64 encoded images
            output_dir: Directory to save images
            prompt_prefix: Prefix for filename
            
        Returns:
            List of saved file paths
        """
        os.makedirs(output_dir, exist_ok=True)
        saved_paths = []
        
        for i, base64_image in enumerate(base64_images):
            try:
                # Decode base64 image
                image_data = base64.b64decode(base64_image)
                image = Image.open(BytesIO(image_data))
                
                # Generate filename
                safe_prompt = "".join(c for c in prompt_prefix if c.isalnum() or c in (' ', '-', '_')).rstrip()
                filename = f"{safe_prompt}_{i+1:03d}.png"
                filepath = os.path.join(output_dir, filename)
                
                # Save image
                image.save(filepath, "PNG")
                saved_paths.append(filepath)
                print(f"Saved: {filepath} ({image.width}x{image.height})")
                
            except Exception as e:
                print(f"Failed to save image {i+1}: {e}")
                
        return saved_paths
    
    def get_models(self) -> list:
        """Get list of available models"""
        try:
            response = self.session.get(f"{self.base_url}/sdapi/v1/sd-models")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Failed to get models: {e}")
            return []
    
    def get_samplers(self) -> list:
        """Get list of available samplers"""
        try:
            response = self.session.get(f"{self.base_url}/sdapi/v1/samplers")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Failed to get samplers: {e}")
            return []
    
    def get_upscalers(self) -> list:
        """Get list of available upscalers"""
        try:
            response = self.session.get(f"{self.base_url}/sdapi/v1/upscalers")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Failed to get upscalers: {e}")
            return []
    
    def get_adetailer_models(self) -> list:
        """Get list of available ADetailer models"""
        try:
            response = self.session.get(f"{self.base_url}/adetailer/v1/ad_model")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Failed to get ADetailer models: {e}")
            return []

def main():
    """Example usage of the high-res image generation with ADetailer"""
    
    # Initialize the client
    client = StableDiffusionHiRes("http://127.0.0.1:7860")
    
    # Optional: List available resources
    print("Available upscalers:", [u['name'] for u in client.get_upscalers()])
    print("Available ADetailer models:", client.get_adetailer_models())
    
    # Example prompts
    prompts = [
        "portrait of a beautiful woman, detailed face, professional photography, studio lighting",
        "portrait of a wise old wizard with flowing beard, magical atmosphere, fantasy art style, intricate details"
    ]
    
    for i, prompt in enumerate(prompts, 1):
        print(f"\n=== Generating Image {i}/{len(prompts)} ===")
        print(f"Prompt: {prompt}")
        
        try:
            result = client.generate_hires_image(
                prompt=prompt,
                negative_prompt="blurry, low quality, distorted, watermark, signature",
                width=832,           
                height=1216,          
                hr_scale=1.5,
                hr_upscaler="remacri_original",
                steps=25,
                hr_second_pass_steps=15,
                cfg_scale=7.0,
                hr_cfg=5.0,
                denoising_strength=0.7,
                sampler_name="DPM++ 2M",
                scheduler="Karras",
                seed=-1,
                use_adetailer=True,
                adetailer_models=["face_yolov8n.pt"],
                save_images=True,
                output_dir="hires_output"
            )
            
            print(f"Generation completed!")
            if 'saved_paths' in result:
                print(f"Images saved: {len(result['saved_paths'])}")
                
        except Exception as e:
            print(f"Generation failed: {e}")

if __name__ == "__main__":
    main()